import { AssessmentLayerCode } from "@prisma/client";
import { z } from "zod";
import { build_reliability_snapshot } from "@/lib/scoring-pipeline";
import { prisma } from "@/lib/db";
import { compute_linear_delta_r_squared, compute_selection_rate_ratio, infer_validity_status, pearson_correlation } from "@/lib/insight-utils";
import { round_number } from "@/lib/scoring/utils";

const validity_type_schema = z.enum([
  "CONSTRUCT",
  "CRITERION",
  "INTERNAL_RELIABILITY",
  "TEST_RETEST",
  "ADVERSE_IMPACT",
  "INCREMENTAL",
]);

export const validity_compute_schema = z.object({
  validity_type: validity_type_schema.optional(),
});

export async function get_validity_dashboard_snapshot(org_id: string) {
  const [evidence, layers, role_families] = await Promise.all([
    prisma.validityEvidence.findMany({
      where: {
        deleted_at: null,
        org_id,
      },
      include: {
        assessment_layer: true,
        role_family: true,
        sub_dimension: true,
      },
      orderBy: [{ computed_at: "desc" }],
    }),
    prisma.assessmentLayer.findMany({
      where: {
        deleted_at: null,
      },
      orderBy: { name: "asc" },
    }),
    prisma.roleFamily.findMany({
      where: {
        deleted_at: null,
        org_id,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    alerts: evidence
      .filter((entry) => !entry.pass_fail)
      .slice(0, 12)
      .map((entry) => ({
        computed_at: entry.computed_at.toISOString(),
        layer_name: entry.assessment_layer?.name ?? "Overall",
        metric_name: entry.metric_name,
        notes: entry.notes,
        role_family_name: entry.role_family?.name ?? "All roles",
        sample_n: entry.sample_n,
        validity_type: entry.validity_type,
      })),
    evidence: evidence.map((entry) => ({
      computed_at: entry.computed_at.toISOString(),
      layer_code: entry.assessment_layer?.code ?? "OVERALL",
      layer_name: entry.assessment_layer?.name ?? "Overall",
      metric_name: entry.metric_name,
      metric_value: entry.metric_value,
      notes: entry.notes,
      pass_fail: entry.pass_fail,
      preliminary: entry.sample_n < 30,
      role_family_name: entry.role_family?.name ?? "All roles",
      sample_n: entry.sample_n,
      status: infer_validity_status(entry.metric_value, entry.threshold, entry.validity_type !== "CONSTRUCT" || entry.metric_name !== "RMSEA"),
      sub_dimension_name: entry.sub_dimension?.name ?? null,
      threshold: entry.threshold,
      validity_type: entry.validity_type,
    })),
    layers: layers.map((layer) => ({ code: layer.code, name: layer.name })),
    role_families: role_families.map((role_family) => ({ id: role_family.id, name: role_family.name })),
  };
}

export async function recompute_validity_evidence(input: {
  org_id: string;
  validity_type?: z.infer<typeof validity_type_schema>;
}) {
  const types = input.validity_type ? [input.validity_type] : validity_type_schema.options;

  for (const type of types) {
    await prisma.validityEvidence.deleteMany({
      where: {
        org_id: input.org_id,
        validity_type: type,
      },
    });

    const rows = await build_validity_rows(input.org_id, type);

    if (rows.length) {
      await prisma.validityEvidence.createMany({
        data: rows.map((row) => ({
          computed_at: row.computed_at,
          layer_id: row.layer_id,
          metric_name: row.metric_name,
          metric_value: row.metric_value,
          notes: row.notes,
          org_id: input.org_id,
          pass_fail: row.pass_fail,
          role_family_id: row.role_family_id,
          sample_n: row.sample_n,
          sub_dimension_id: row.sub_dimension_id,
          threshold: row.threshold,
          validity_type: type,
        })),
      });
    }
  }
}

async function build_validity_rows(org_id: string, validity_type: z.infer<typeof validity_type_schema>) {
  switch (validity_type) {
    case "INTERNAL_RELIABILITY":
      return build_internal_reliability_rows(org_id);
    case "CRITERION":
      return build_criterion_rows(org_id);
    case "CONSTRUCT":
      return build_construct_rows(org_id);
    case "TEST_RETEST":
      return build_test_retest_rows(org_id);
    case "ADVERSE_IMPACT":
      return build_adverse_impact_rows(org_id);
    case "INCREMENTAL":
      return build_incremental_rows(org_id);
    default:
      return [];
  }
}

async function build_internal_reliability_rows(org_id: string) {
  const snapshot = await build_reliability_snapshot({
    model_version: null,
    org_id,
  });
  const layers = await prisma.assessmentLayer.findMany({
    where: {
      deleted_at: null,
    },
  });
  const layer_lookup = new Map(layers.map((layer) => [layer.code, layer.id]));

  return snapshot.map((entry) => ({
    computed_at: new Date(),
    layer_id: layer_lookup.get(entry.layer_code as AssessmentLayerCode) ?? null,
    metric_name: "Cronbach alpha",
    metric_value: entry.alpha ?? 0,
    notes:
      entry.respondent_count < 30
        ? "Preliminary reliability estimate. Sample size is below 30."
        : "Internal consistency estimate from scored response matrix.",
    pass_fail: (entry.alpha ?? 0) >= 0.75,
    role_family_id: null,
    sample_n: entry.respondent_count,
    sub_dimension_id: entry.sub_dimension_id,
    threshold: 0.75,
  }));
}

async function build_criterion_rows(org_id: string) {
  const assessments = await prisma.assessment.findMany({
    where: {
      deleted_at: null,
      org_id,
      status: "COMPLETED",
    },
    include: {
      outcome_records: true,
      role_family: true,
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
  });

  const rows: Array<{
    computed_at: Date;
    layer_id: string | null;
    metric_name: string;
    metric_value: number;
    notes: string;
    pass_fail: boolean;
    role_family_id: string | null;
    sample_n: number;
    sub_dimension_id: string | null;
    threshold: number;
  }> = [];

  for (const role_family of dedupe_role_families(assessments.map((assessment) => assessment.role_family))) {
    const role_assessments = assessments.filter((assessment) => assessment.role_family_id === role_family.id);

    for (const layer_code of Object.values(AssessmentLayerCode)) {
      const pairs = role_assessments
        .flatMap((assessment) =>
          assessment.outcome_records.map((outcome) => ({
            outcome_value: outcome.metric_value,
            score:
              assessment.scores.find((score) => score.assessment_layer.code === layer_code)?.normalized_score_0_100 ??
              assessment.scores.find((score) => score.assessment_layer.code === layer_code)?.raw_score ??
              null,
          })),
        )
        .filter((entry): entry is { outcome_value: number; score: number } => entry.score !== null);
      const correlation = pearson_correlation(
        pairs.map((pair) => pair.score),
        pairs.map((pair) => pair.outcome_value),
      );

      rows.push({
        computed_at: new Date(),
        layer_id: pairs.length ? role_assessments.find((assessment) => assessment.scores.find((score) => score.assessment_layer.code === layer_code))?.scores.find((score) => score.assessment_layer.code === layer_code)?.layer_id ?? null : null,
        metric_name: "Criterion correlation",
        metric_value: correlation ?? 0,
        notes:
          pairs.length < 30
            ? "Preliminary criterion validity estimate. Fewer than 30 linked outcomes are available."
            : "Pearson correlation between layer scores and linked KPI outcomes.",
        pass_fail: (correlation ?? 0) >= 0.25,
        role_family_id: role_family.id,
        sample_n: pairs.length,
        sub_dimension_id: null,
        threshold: 0.25,
      });
    }
  }

  return rows;
}

async function build_construct_rows(org_id: string) {
  const assessments = await prisma.assessment.findMany({
    where: {
      deleted_at: null,
      org_id,
      status: "COMPLETED",
    },
    include: {
      role_family: true,
      scores: {
        where: {
          deleted_at: null,
        },
        include: {
          assessment_layer: true,
        },
      },
    },
  });
  const rows: Array<{
    computed_at: Date;
    layer_id: string | null;
    metric_name: string;
    metric_value: number;
    notes: string;
    pass_fail: boolean;
    role_family_id: string | null;
    sample_n: number;
    sub_dimension_id: string | null;
    threshold: number;
  }> = [];

  for (const role_family of dedupe_role_families(assessments.map((assessment) => assessment.role_family))) {
    const role_assessments = assessments.filter((assessment) => assessment.role_family_id === role_family.id);

    for (const layer_code of Object.values(AssessmentLayerCode)) {
      const aligned = role_assessments
        .map((assessment) => {
          const layer_score = assessment.scores.find((score) => score.assessment_layer.code === layer_code && score.sub_dimension_id === null);
          const sub_scores = assessment.scores.filter((score) => score.assessment_layer.code === layer_code && score.sub_dimension_id !== null);

          if (!layer_score || !sub_scores.length) {
            return null;
          }

          return {
            layer_score: layer_score.normalized_score_0_100 ?? layer_score.raw_score ?? 0,
            sub_dimension_average:
              sub_scores.reduce((sum, score) => sum + (score.normalized_score_0_100 ?? score.raw_score ?? 0), 0) / sub_scores.length,
          };
        })
        .filter((entry): entry is { layer_score: number; sub_dimension_average: number } => Boolean(entry));
      const correlation = pearson_correlation(
        aligned.map((entry) => entry.layer_score),
        aligned.map((entry) => entry.sub_dimension_average),
      );
      const layer_id =
        role_assessments
          .flatMap((assessment) => assessment.scores)
          .find((score) => score.assessment_layer.code === layer_code)?.layer_id ?? null;

      rows.push({
        computed_at: new Date(),
        layer_id,
        metric_name: "Construct coherence proxy",
        metric_value: correlation ?? 0,
        notes:
          aligned.length < 30
            ? "Preliminary construct validity proxy based on layer-to-subdimension alignment."
            : "Construct validity proxy based on layer-to-subdimension alignment correlation.",
        pass_fail: (correlation ?? 0) >= 0.4,
        role_family_id: role_family.id,
        sample_n: aligned.length,
        sub_dimension_id: null,
        threshold: 0.4,
      });
    }
  }

  return rows;
}

async function build_test_retest_rows(org_id: string) {
  const assessments = await prisma.assessment.findMany({
    where: {
      deleted_at: null,
      org_id,
      status: "COMPLETED",
    },
    include: {
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
    orderBy: [{ completed_at: "asc" }],
  });
  const by_candidate = new Map<string, typeof assessments>();

  for (const assessment of assessments) {
    by_candidate.set(assessment.candidate_id, [...(by_candidate.get(assessment.candidate_id) ?? []), assessment]);
  }

  const rows: Array<{
    computed_at: Date;
    layer_id: string | null;
    metric_name: string;
    metric_value: number;
    notes: string;
    pass_fail: boolean;
    role_family_id: string | null;
    sample_n: number;
    sub_dimension_id: string | null;
    threshold: number;
  }> = [];

  for (const layer_code of Object.values(AssessmentLayerCode)) {
    const first_scores: number[] = [];
    const second_scores: number[] = [];
    let layer_id: string | null = null;

    for (const candidate_assessments of by_candidate.values()) {
      if (candidate_assessments.length < 2) {
        continue;
      }

      const first = candidate_assessments[0];
      const second = candidate_assessments[candidate_assessments.length - 1];
      const first_score = first.scores.find((score) => score.assessment_layer.code === layer_code);
      const second_score = second.scores.find((score) => score.assessment_layer.code === layer_code);

      if (!first_score || !second_score) {
        continue;
      }

      layer_id = first_score.layer_id;
      first_scores.push(first_score.normalized_score_0_100 ?? first_score.raw_score ?? 0);
      second_scores.push(second_score.normalized_score_0_100 ?? second_score.raw_score ?? 0);
    }

    const stability = pearson_correlation(first_scores, second_scores);

    rows.push({
      computed_at: new Date(),
      layer_id,
      metric_name: "Test-retest stability",
      metric_value: stability ?? 0,
      notes:
        first_scores.length < 30
          ? "Preliminary stability estimate. Fewer than 30 repeat administrations are available."
          : "Correlation between earliest and latest administrations by candidate.",
      pass_fail: (stability ?? 0) >= 0.8,
      role_family_id: null,
      sample_n: first_scores.length,
      sub_dimension_id: null,
      threshold: 0.8,
    });
  }

  return rows;
}

async function build_adverse_impact_rows(org_id: string) {
  const assessments = await prisma.assessment.findMany({
    where: {
      deleted_at: null,
      org_id,
      status: "COMPLETED",
      is_high_stakes: true,
    },
    include: {
      candidate: true,
      role_family: true,
      role_fit_results: {
        where: { deleted_at: null },
        orderBy: { created_at: "desc" },
        take: 1,
      },
    },
  });
  const rows: Array<{
    computed_at: Date;
    layer_id: string | null;
    metric_name: string;
    metric_value: number;
    notes: string;
    pass_fail: boolean;
    role_family_id: string | null;
    sample_n: number;
    sub_dimension_id: string | null;
    threshold: number;
  }> = [];

  for (const role_family of dedupe_role_families(assessments.map((assessment) => assessment.role_family))) {
    const role_assessments = assessments.filter((assessment) => assessment.role_family_id === role_family.id);
    const groups = new Map<string, { selected: number; total: number }>();

    for (const assessment of role_assessments) {
      const group = assessment.candidate.demographic_group ?? "Undisclosed";
      const recommendation = assessment.role_fit_results[0]?.recommendation ?? null;
      const selected = recommendation === "FIT" || recommendation === "STRONG_FIT";
      const current = groups.get(group) ?? { selected: 0, total: 0 };
      groups.set(group, {
        selected: current.selected + Number(selected),
        total: current.total + 1,
      });
    }

    const ratios = compute_selection_rate_ratio(
      Array.from(groups.entries()).map(([group, stats]) => ({
        group,
        selected: stats.selected,
        total: stats.total,
      })),
    );
    const minimum_ratio = Math.min(...ratios.map((entry) => entry.ratio_to_reference ?? 1), 1);

    rows.push({
      computed_at: new Date(),
      layer_id: null,
      metric_name: "4/5ths rule ratio",
      metric_value: round_number(minimum_ratio, 4),
      notes:
        ratios.length < 2
          ? "Adverse-impact monitoring is preliminary because demographic group diversity is limited."
          : `Group ratios: ${ratios.map((entry) => `${entry.group}=${entry.ratio_to_reference ?? "n/a"}`).join(", ")}`,
      pass_fail: minimum_ratio >= 0.8,
      role_family_id: role_family.id,
      sample_n: role_assessments.length,
      sub_dimension_id: null,
      threshold: 0.8,
    });
  }

  return rows;
}

async function build_incremental_rows(org_id: string) {
  const assessments = await prisma.assessment.findMany({
    where: {
      deleted_at: null,
      org_id,
      status: "COMPLETED",
    },
    include: {
      outcome_records: true,
      role_family: true,
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
  });
  const rows: Array<{
    computed_at: Date;
    layer_id: string | null;
    metric_name: string;
    metric_value: number;
    notes: string;
    pass_fail: boolean;
    role_family_id: string | null;
    sample_n: number;
    sub_dimension_id: string | null;
    threshold: number;
  }> = [];

  for (const role_family of dedupe_role_families(assessments.map((assessment) => assessment.role_family))) {
    const role_assessments = assessments.filter((assessment) => assessment.role_family_id === role_family.id);
    const cognitive_pairs = role_assessments
      .flatMap((assessment) =>
        assessment.outcome_records.map((outcome) => ({
          outcome: outcome.metric_value,
          score: assessment.scores.find((score) => score.assessment_layer.code === "COGNITIVE")?.normalized_score_0_100 ?? null,
        })),
      )
      .filter((entry): entry is { outcome: number; score: number } => entry.score !== null);
    const baseline = cognitive_pairs.map((entry) => entry.score);
    for (const layer_code of Object.values(AssessmentLayerCode).filter((value) => value !== "COGNITIVE")) {
      const combined_pairs = role_assessments
        .flatMap((assessment) =>
          assessment.outcome_records.map((outcome) => {
            const cognitive = assessment.scores.find((score) => score.assessment_layer.code === "COGNITIVE")?.normalized_score_0_100 ?? null;
            const layer = assessment.scores.find((score) => score.assessment_layer.code === layer_code)?.normalized_score_0_100 ?? null;

            if (cognitive === null || layer === null) {
              return null;
            }

            return {
              combined: (cognitive + layer) / 2,
              outcome: outcome.metric_value,
            };
          }),
        )
        .filter((entry): entry is { combined: number; outcome: number } => Boolean(entry));
      const delta_r2 = compute_linear_delta_r_squared({
        baseline_scores: baseline.slice(0, combined_pairs.length),
        comparison_scores: combined_pairs.map((entry) => entry.combined),
        outcomes: combined_pairs.map((entry) => entry.outcome),
      });
      const layer_id =
        role_assessments
          .flatMap((assessment) => assessment.scores)
          .find((score) => score.assessment_layer.code === layer_code)?.layer_id ?? null;

      rows.push({
        computed_at: new Date(),
        layer_id,
        metric_name: "Incremental validity deltaR2",
        metric_value: delta_r2 ?? 0,
        notes:
          combined_pairs.length < 30
            ? "Preliminary incremental validity estimate using cognitive-only vs cognitive-plus-layer comparison."
            : "Incremental validity estimate using cognitive-only vs cognitive-plus-layer comparison.",
        pass_fail: (delta_r2 ?? 0) >= 0.02,
        role_family_id: role_family.id,
        sample_n: combined_pairs.length,
        sub_dimension_id: null,
        threshold: 0.02,
      });
    }
  }

  return rows;
}

function dedupe_role_families(role_families: Array<{ id: string; name: string }>) {
  return Array.from(new Map(role_families.map((role_family) => [role_family.id, role_family])).values());
}
