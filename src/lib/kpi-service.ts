import { MeasurementFrequency } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { pearson_correlation, spearman_correlation } from "@/lib/insight-utils";
import { round_number } from "@/lib/scoring/utils";

export const kpi_definition_schema = z.object({
  data_source: z.string().min(2).max(120),
  kpi_description: z.string().min(10).max(1000),
  kpi_name: z.string().min(3).max(120),
  measurement_frequency: z.nativeEnum(MeasurementFrequency),
  measurement_unit: z.string().min(1).max(40),
  prediction_horizon_months: z.number().int().min(3).max(24),
  role_family_id: z.string().min(1),
});

export const kpi_observation_schema = z.object({
  kpi_definition_id: z.string().min(1),
  observation_date: z.string().datetime(),
  period_end: z.string().datetime(),
  period_start: z.string().datetime(),
  user_id: z.string().min(1),
  value: z.number(),
});

const horizon_map = {
  COGNITIVE: [3, 6],
  EXECUTION: [3, 6, 12],
  LEADERSHIP: [6, 12],
  MOTIVATORS: [12, 24],
  PERSONALITY: [6, 12],
  SJT: [3, 6, 12],
} as const;

export async function get_kpi_dashboard_snapshot(org_id: string) {
  const [definitions, observations, correlations, board_summary] = await Promise.all([
    prisma.kpiDefinition.findMany({
      where: {
        deleted_at: null,
        org_id,
      },
      include: {
        kpi_observations: {
          where: { deleted_at: null },
          orderBy: { observation_date: "desc" },
          take: 4,
        },
        role_family: true,
      },
      orderBy: [{ role_family: { name: "asc" } }, { kpi_name: "asc" }],
    }),
    prisma.kpiObservation.findMany({
      where: {
        deleted_at: null,
        kpi_definition: {
          org_id,
        },
      },
      include: {
        kpi_definition: {
          include: {
            role_family: true,
          },
        },
        user: {
          select: {
            manager: {
              select: {
                id: true,
                manager_quality_score: true,
                name: true,
              },
            },
            name: true,
          },
        },
      },
      orderBy: [{ observation_date: "desc" }],
      take: 50,
    }),
    compute_role_family_correlations(org_id),
    build_ebitda_board_summary(org_id),
  ]);

  return {
    board_summary,
    correlations,
    definitions: definitions.map((definition) => ({
      data_source: definition.data_source,
      id: definition.id,
      kpi_description: definition.kpi_description,
      kpi_name: definition.kpi_name,
      measurement_frequency: definition.measurement_frequency,
      measurement_unit: definition.measurement_unit,
      observation_count: definition.kpi_observations.length,
      prediction_horizon_months: definition.prediction_horizon_months,
      recent_observations: definition.kpi_observations.map((observation) => ({
        observation_date: observation.observation_date.toISOString(),
        value: observation.value,
      })),
      role_family_id: definition.role_family_id,
      role_family_name: definition.role_family.name,
    })),
    horizon_summary: build_horizon_summary(observations),
    recent_observations: observations.map((observation) => ({
      kpi_name: observation.kpi_definition.kpi_name,
      manager_name: observation.user.manager?.name ?? null,
      manager_quality_score: observation.user.manager?.manager_quality_score ?? null,
      observation_date: observation.observation_date.toISOString(),
      role_family_name: observation.kpi_definition.role_family.name,
      user_name: observation.user.name,
      value: observation.value,
    })),
  };
}

export async function create_kpi_definition(input: {
  data: z.infer<typeof kpi_definition_schema>;
  org_id: string;
}) {
  return prisma.kpiDefinition.create({
    data: {
      data_source: input.data.data_source,
      kpi_description: input.data.kpi_description,
      kpi_name: input.data.kpi_name,
      measurement_frequency: input.data.measurement_frequency,
      measurement_unit: input.data.measurement_unit,
      org_id: input.org_id,
      prediction_horizon_months: input.data.prediction_horizon_months,
      role_family_id: input.data.role_family_id,
    },
  });
}

export async function create_kpi_observation(input: z.infer<typeof kpi_observation_schema>) {
  const observation = await prisma.kpiObservation.create({
    data: {
      kpi_definition_id: input.kpi_definition_id,
      observation_date: new Date(input.observation_date),
      period_end: new Date(input.period_end),
      period_start: new Date(input.period_start),
      user_id: input.user_id,
      value: input.value,
    },
    include: {
      kpi_definition: true,
    },
  });
  const latest_assessment = await prisma.assessment.findFirst({
    where: {
      candidate_id: input.user_id,
      deleted_at: null,
      role_family_id: observation.kpi_definition.role_family_id,
      status: "COMPLETED",
    },
    orderBy: [{ completed_at: "desc" }],
  });

  if (latest_assessment) {
    await prisma.outcomeRecord.create({
      data: {
        assessment_id: latest_assessment.id,
        kpi_definition_id: observation.kpi_definition_id,
        metric_name: observation.kpi_definition.kpi_name,
        metric_value: observation.value,
        observation_period: `${input.period_start}::${input.period_end}`,
        user_id: input.user_id,
      },
    });
  }

  return observation;
}

export async function compute_role_family_correlations(org_id: string, role_family_id?: string) {
  const definitions = await prisma.kpiDefinition.findMany({
    where: {
      deleted_at: null,
      org_id,
      ...(role_family_id ? { role_family_id } : {}),
    },
    include: {
      role_family: true,
      outcome_records: {
        where: { deleted_at: null },
        include: {
          assessment: {
            include: {
              candidate: {
                include: {
                  manager: true,
                },
              },
              scores: {
                where: {
                  deleted_at: null,
                  sub_dimension_id: null,
                },
                include: {
                  assessment_layer: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return definitions.map((definition) => {
    const layer_rows = definition.outcome_records.flatMap((record) =>
      record.assessment.scores.map((score) => ({
        layer_code: score.assessment_layer.code,
        manager_id: record.assessment.candidate.manager_id,
        manager_quality_score: record.assessment.candidate.manager?.manager_quality_score ?? 0,
        metric_value: record.metric_value,
        role_family_name: definition.role_family.name,
        score_value: score.normalized_score_0_100 ?? score.raw_score ?? 0,
      })),
    );

    const by_layer = Array.from(
      new Map(
        layer_rows.map((row) => [
          row.layer_code,
          layer_rows.filter((entry) => entry.layer_code === row.layer_code),
        ]),
      ).entries(),
    );

    return {
      kpi_name: definition.kpi_name,
      role_family_name: definition.role_family.name,
      sample_n: definition.outcome_records.length,
      small_n_warning: definition.outcome_records.length < 30,
      summaries: by_layer.map(([layer_code, rows]) => {
        const naive = pearson_correlation(
          rows.map((row) => row.score_value),
          rows.map((row) => row.metric_value),
        );
        const adjusted = pearson_correlation(
          rows.map((row) => row.score_value),
          rows.map((row) => row.metric_value - row.manager_quality_score),
        );
        const within_manager = compute_within_manager_correlation(rows);

        return {
          adjusted_correlation: adjusted,
          layer_code,
          naive_correlation: naive,
          spearman_correlation: spearman_correlation(
            rows.map((row) => row.score_value),
            rows.map((row) => row.metric_value),
          ),
          within_manager_correlation: within_manager,
        };
      }),
    };
  });
}

async function build_ebitda_board_summary(org_id: string) {
  const outcome_records = await prisma.outcomeRecord.findMany({
    where: {
      deleted_at: null,
      assessment: {
        org_id,
      },
    },
    include: {
      assessment: {
        include: {
          role_family: true,
          scores: {
            where: {
              deleted_at: null,
              sub_dimension_id: {
                not: null,
              },
            },
            include: {
              sub_dimension: true,
            },
          },
        },
      },
      kpi_definition: true,
    },
  });
  const relevant_records = outcome_records.filter((record) =>
    /ebitda|revenue|oee|cost/i.test(record.metric_name) || /ebitda|revenue|oee|cost/i.test(record.kpi_definition.kpi_name),
  );
  const trait_buckets = new Map<string, { outcomes: number[]; scores: number[] }>();

  for (const record of relevant_records) {
    for (const score of record.assessment.scores) {
      const name = score.sub_dimension?.name;

      if (!name) {
        continue;
      }

      const bucket = trait_buckets.get(name) ?? { outcomes: [], scores: [] };
      bucket.outcomes.push(record.metric_value);
      bucket.scores.push(score.normalized_score_0_100 ?? score.raw_score ?? 0);
      trait_buckets.set(name, bucket);
    }
  }

  const sensitivities = Array.from(trait_buckets.entries())
    .map(([trait_name, bucket]) => {
      const correlation = pearson_correlation(bucket.scores, bucket.outcomes);
      return {
        estimated_ebitda_lift_pct: correlation !== null ? round_number(Math.abs(correlation) * 12, 2) : null,
        sample_n: bucket.scores.length,
        small_n_warning: bucket.scores.length < 30,
        trait_name,
      };
    })
    .sort((left, right) => (right.estimated_ebitda_lift_pct ?? 0) - (left.estimated_ebitda_lift_pct ?? 0))
    .slice(0, 6);

  return {
    direct_line_of_sight_roles: Array.from(new Set(relevant_records.map((record) => record.assessment.role_family.name))),
    headline:
      sensitivities.length >= 2
        ? `Top trait levers: ${sensitivities[0]!.trait_name} and ${sensitivities[1]!.trait_name}`
        : "More linked outcome data is needed before EBITDA sensitivity can be trusted.",
    sensitivities,
  };
}

function build_horizon_summary(
  observations: Array<{
    kpi_definition: { role_family: { name: string } };
    observation_date: Date;
    user: { name: string };
  }>,
) {
  const summary = Object.entries(horizon_map).map(([layer_code, checkpoints]) => ({
    checkpoints: checkpoints.map((month) => ({
      checkpoint_month: month,
      observation_count: observations.filter((observation) => observation.observation_date.getUTCMonth() + 1 >= month).length,
    })),
    layer_code,
  }));

  return summary;
}

function compute_within_manager_correlation(
  rows: Array<{
    manager_id: string | null;
    metric_value: number;
    score_value: number;
  }>,
) {
  const groups = Array.from(
    new Map(
      rows.map((row) => [
        row.manager_id ?? "unassigned",
        rows.filter((entry) => (entry.manager_id ?? "unassigned") === (row.manager_id ?? "unassigned")),
      ]),
    ).values(),
  );
  const centered_scores: number[] = [];
  const centered_outcomes: number[] = [];

  for (const group of groups) {
    const mean_score = group.reduce((sum, row) => sum + row.score_value, 0) / Math.max(group.length, 1);
    const mean_outcome = group.reduce((sum, row) => sum + row.metric_value, 0) / Math.max(group.length, 1);

    for (const row of group) {
      centered_scores.push(row.score_value - mean_score);
      centered_outcomes.push(row.metric_value - mean_outcome);
    }
  }

  return pearson_correlation(centered_scores, centered_outcomes);
}
