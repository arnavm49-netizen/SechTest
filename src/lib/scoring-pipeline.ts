import {
  AssessmentStatus,
  Prisma,
  RaterAssignmentStatus,
  RaterRelationship,
  ScoringRunStatus,
} from "@prisma/client";
import type { AssessmentLayerCode, RoleFitRecommendation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalize_item_options } from "@/lib/question-bank";
import { build_development_gaps, compute_role_fit, normalize_construct_score } from "@/lib/scoring/aggregation";
import { score_classical_response } from "@/lib/scoring/classical";
import { normalize_scoring_model_config, resolve_ideal_ranges } from "@/lib/scoring/config";
import { estimate_theta_3pl, estimate_thurstonian_vector, select_next_cat_item } from "@/lib/scoring/irt";
import { build_percentile_lookup, calculate_cronbach_alpha, mean, standard_deviation } from "@/lib/scoring/math";
import { evaluate_response_quality, should_invalidate } from "@/lib/scoring/quality";
import type {
  ConstructScore,
  DevelopmentGap,
  LayerScore,
  ResponseQualityFlag,
  ScoreComparability,
  ScoredItemResult,
  ScoringEngineMode,
  ScoringResponse,
} from "@/lib/scoring/types";
import { as_array, as_number, as_record, as_string, round_number } from "@/lib/scoring/utils";

type RawConstructScore = {
  comparability: ScoreComparability;
  explanation: string;
  layer_code: AssessmentLayerCode;
  percentile_hint: number | null;
  raw_score: number;
  raw_score_max: number;
  raw_score_min: number;
  sub_dimension_id: string;
  sub_dimension_name: string;
  z_score_hint: number | null;
};

type NormStatisticSeed = {
  mean: number;
  percentile_lookup: Record<string, number>;
  sample_n: number;
  std_dev: number;
  sub_dimension_id: string;
};

type PipelineResult = {
  fit_score_pct: number | null;
  recommendation: RoleFitRecommendation | null;
  run_id: string;
  status: ScoringRunStatus;
  step_outputs: Record<string, unknown> | null;
};

export async function execute_scoring_pipeline(input: {
  assessment_id: string;
  scoring_model_id: string;
}): Promise<PipelineResult> {
  const [assessment, scoring_model, personality_sub_dimensions, development_recommendations] = await Promise.all([
    prisma.assessment.findFirst({
      where: {
        deleted_at: null,
        id: input.assessment_id,
      },
      include: {
        assessment_version: true,
        candidate: true,
        responses: {
          where: { deleted_at: null },
          orderBy: { sequence_number: "asc" },
          include: {
            item: {
              include: {
                assessment_layer: true,
                item_options: {
                  where: { deleted_at: null },
                  orderBy: { display_order: "asc" },
                },
                sub_dimension: true,
              },
            },
          },
        },
        sections: {
          where: { deleted_at: null },
          include: {
            assessment_layer: true,
          },
        },
        rater_assignments: {
          where: {
            deleted_at: null,
            relationship: {
              in: [RaterRelationship.PEER, RaterRelationship.MANAGER],
            },
            status: RaterAssignmentStatus.COMPLETED,
          },
          include: {
            rater_responses: {
              where: { deleted_at: null },
              include: {
                item: {
                  include: {
                    assessment_layer: true,
                    item_options: {
                      where: { deleted_at: null },
                      orderBy: { display_order: "asc" },
                    },
                    sub_dimension: true,
                  },
                },
              },
            },
          },
        },
        role_family: true,
      },
    }),
    prisma.scoringModel.findFirst({
      where: {
        deleted_at: null,
        id: input.scoring_model_id,
      },
    }),
    prisma.subDimension.findMany({
      where: {
        deleted_at: null,
        assessment_layer: {
          code: "PERSONALITY",
        },
      },
      include: {
        assessment_layer: true,
      },
    }),
    prisma.developmentRecommendation.findMany({
      where: {
        deleted_at: null,
      },
    }),
  ]);

  if (!assessment) {
    throw new Error("Assessment not found.");
  }

  if (!scoring_model || scoring_model.org_id !== assessment.org_id) {
    throw new Error("Scoring model not found.");
  }

  const engine_mode = scoring_model.engine_mode as ScoringEngineMode;
  const config = normalize_scoring_model_config(scoring_model.config, engine_mode);
  const serialized_responses = assessment.responses.map(serialize_response);
  const existing_flags = normalize_existing_quality_flags(assessment.quality_flags);
  const computed_flags = evaluate_response_quality(serialized_responses, config);
  const quality_flags = dedupe_quality_flags([...existing_flags, ...computed_flags]);
  const invalidated = should_invalidate(quality_flags, config);
  const norm_group = await ensure_default_norm_group(assessment.org_id, config.norms.default_norm_group_name);

  const initial_run = await prisma.scoringRun.create({
    data: {
      assessment_id: assessment.id,
      quality_gate_passed: !invalidated,
      scoring_model_id: scoring_model.id,
      status: invalidated ? ScoringRunStatus.INVALIDATED : ScoringRunStatus.PENDING,
    },
  });

  if (invalidated) {
    const invalid_reason = "Response-quality thresholds exceeded prior to score computation.";

    await prisma.$transaction([
      prisma.scoredResponse.deleteMany({
        where: {
          scoring_run_id: initial_run.id,
        },
      }),
      prisma.score.deleteMany({
        where: {
          assessment_id: assessment.id,
        },
      }),
      prisma.roleFitResult.deleteMany({
        where: {
          assessment_id: assessment.id,
        },
      }),
      prisma.developmentPlan.deleteMany({
        where: {
          assessment_id: assessment.id,
        },
      }),
      prisma.assessment.update({
        where: { id: assessment.id },
        data: {
          quality_flags: to_nullable_json_input(quality_flags),
          status: AssessmentStatus.INVALIDATED,
        },
      }),
      prisma.scoringRun.update({
        where: { id: initial_run.id },
        data: {
          completed_at: new Date(),
          invalid_reason,
          status: ScoringRunStatus.INVALIDATED,
          step_outputs: to_nullable_json_input({
            phase: engine_mode,
            quality_flags,
            quality_gate_passed: false,
          }),
        },
      }),
    ]);

    return {
      fit_score_pct: null,
      recommendation: null,
      run_id: initial_run.id,
      status: ScoringRunStatus.INVALIDATED,
      step_outputs: {
        phase: engine_mode,
        quality_flags,
        quality_gate_passed: false,
      },
    };
  }

  const scored_items = serialized_responses.map((response) => score_classical_response(response, config));
  const peer_items = assessment.rater_assignments.flatMap((assignment) =>
    assignment.rater_responses.map((response) =>
      score_classical_response(
        {
          assessment_id: assessment.id,
          id: `rater-${response.id}`,
          item: serialize_item(response.item),
          response_time_seconds: response.response_time_seconds,
          response_value: response.response_value,
          sequence_number: 0,
        },
        config,
      ),
    ),
  );
  const personality_lookup = new Map(personality_sub_dimensions.map((entry) => [entry.name, entry]));
  const raw_construct_scores = build_raw_construct_scores({
    config,
    engine_mode,
    personality_lookup,
    scored_items,
  });
  const norm_statistics = await build_norm_statistics({
    assessment_id: assessment.id,
    constructs: raw_construct_scores,
    norm_group_id: norm_group.id,
    percentile_breakpoints: config.norms.percentile_breakpoints,
    scoring_model_version: scoring_model.version_label,
  });
  const construct_scores = raw_construct_scores.map((construct) => {
    const statistic = norm_statistics.get(construct.sub_dimension_id);
    const normalized = normalize_construct_score({
      comparability: construct.comparability,
      norm_mean: statistic?.mean ?? undefined,
      norm_std_dev: statistic?.std_dev ?? undefined,
      phase: engine_mode,
      raw_score: construct.raw_score,
      raw_score_max: construct.raw_score_max,
      raw_score_min: construct.raw_score_min,
    });
    const percentile = construct.percentile_hint ?? normalized.percentile;
    const z = construct.z_score_hint ?? normalized.z_score;

    return {
      comparability: construct.comparability,
      explanation: construct.explanation,
      layer_code: construct.layer_code,
      percentile,
      raw_score: round_number(construct.raw_score, 4),
      reliability_alpha: null,
      sub_dimension_id: construct.sub_dimension_id,
      sub_dimension_name: construct.sub_dimension_name,
      z_score: z,
      normalized_score_0_100: round_number(
        construct.percentile_hint !== null ? construct.percentile_hint : normalized.normalized_score_0_100,
        2,
      ),
    };
  });
  const reliable_construct_scores = await attach_reliability_estimates({
    assessment_id: assessment.id,
    construct_scores,
    scoring_model_id: scoring_model.id,
    scored_items,
  });
  const assessment_version_config = as_record(assessment.assessment_version.scoring_config_snapshot) ?? {};
  const layer_scores = await build_layer_scores({
    assessment_id: assessment.id,
    assessment_org_id: assessment.org_id,
    assessment_role_family_name: assessment.role_family.name,
    assessment_version_config,
    config,
    construct_scores: reliable_construct_scores,
    engine_mode,
    peer_items,
    scored_items,
  });
  const included_layers = resolve_role_fit_layers({
    assessment_version_config,
    config,
    engine_mode,
    role_family_name: assessment.role_family.name,
  });
  const role_fit = compute_role_fit({
    ideal_ranges: resolve_ideal_ranges(config, assessment.role_family.name),
    included_layers,
    layer_scores: layer_scores.reduce<Record<AssessmentLayerCode, number>>((accumulator, layer_score) => {
      accumulator[layer_score.layer_code] = layer_score.normalized_score_0_100;
      return accumulator;
    }, {} as Record<AssessmentLayerCode, number>),
    thresholds: config.fit_thresholds,
    weight_matrix: normalize_weight_matrix(assessment.role_family.weight_matrix),
  });
  const development_gaps = build_development_gaps({
    construct_scores: reliable_construct_scores.map((score) => ({
      normalized_score_0_100: score.normalized_score_0_100,
      percentile: score.percentile,
      recommendation_texts: development_recommendations
        .filter(
          (recommendation) =>
            recommendation.sub_dimension_id === score.sub_dimension_id &&
            score.normalized_score_0_100 >= recommendation.score_range_min &&
            score.normalized_score_0_100 <= recommendation.score_range_max,
        )
        .map((recommendation) => recommendation.recommendation_text),
      sub_dimension_id: score.sub_dimension_id,
      sub_dimension_name: score.sub_dimension_name,
    })),
    gap_percentile_threshold: config.development.gap_percentile_threshold,
    high_stakes_gap_threshold: config.development.high_stakes_gap_threshold,
  });
  const step_outputs = await build_step_outputs({
    assessment_id: assessment.id,
    config,
    development_gaps,
    engine_mode,
    layer_scores,
    quality_flags,
    reliable_construct_scores,
    role_fit,
    scored_items,
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.normGroupMember.upsert({
      where: {
        norm_group_id_assessment_id: {
          assessment_id: assessment.id,
          norm_group_id: norm_group.id,
        },
      },
      create: {
        assessment_id: assessment.id,
        norm_group_id: norm_group.id,
        user_id: assessment.candidate_id,
      },
      update: {
        deleted_at: null,
        user_id: assessment.candidate_id,
      },
    });

    await transaction.scoredResponse.deleteMany({
      where: {
        scoring_run_id: initial_run.id,
      },
    });

    if (scored_items.length) {
      await transaction.scoredResponse.createMany({
        data: scored_items.map((item) => ({
          explanation: to_nullable_json_input(item.explanation),
          item_id: item.item_id,
          layer_id: assessment.responses.find((response) => response.item_id === item.item_id)?.item.layer_id ?? "",
          quality_flags: to_nullable_json_input(item.quality_flags),
          raw_value: to_nullable_json_input(item.raw_value),
          response_id: item.response_id,
          scored_value: item.scored_value,
          scoring_run_id: initial_run.id,
          speed_score: item.speed_score,
          sub_dimension_id: item.sub_dimension_id,
        })),
      });
    }

    await transaction.score.deleteMany({
      where: {
        assessment_id: assessment.id,
      },
    });

    if (reliable_construct_scores.length || layer_scores.length) {
      const layer_id_lookup = new Map([
        ...assessment.sections.map((section) => [section.assessment_layer.code, section.layer_id] as const),
        ...assessment.responses.map((response) => [response.item.assessment_layer.code, response.item.layer_id] as const),
      ]);

      await transaction.score.createMany({
        data: [
          ...reliable_construct_scores.map((score) => ({
            assessment_id: assessment.id,
            irt_theta:
              engine_mode === "PHASE_B_HYBRID_IRT" && (score.layer_code === "COGNITIVE" || score.layer_code === "PERSONALITY")
                ? score.z_score
                : null,
            is_valid: true,
            layer_id: layer_id_lookup.get(score.layer_code) ?? get_layer_id_from_responses(assessment.responses, score.layer_code),
            normalized_score_0_100: score.normalized_score_0_100,
            percentile: score.percentile,
            raw_score: score.raw_score,
            reliability_estimate: score.reliability_alpha,
            scoring_model_version: scoring_model.version_label,
            sub_dimension_id: score.sub_dimension_id,
            z_score: score.z_score,
          })),
          ...layer_scores.map((score) => ({
            assessment_id: assessment.id,
            irt_theta:
              engine_mode === "PHASE_B_HYBRID_IRT" && (score.layer_code === "COGNITIVE" || score.layer_code === "PERSONALITY")
                ? score.z_score
                : null,
            is_valid: score.included_in_role_fit,
            layer_id: layer_id_lookup.get(score.layer_code) ?? get_layer_id_from_responses(assessment.responses, score.layer_code),
            normalized_score_0_100: score.normalized_score_0_100,
            percentile: score.percentile,
            raw_score: score.raw_score,
            reliability_estimate: null,
            scoring_model_version: scoring_model.version_label,
            sub_dimension_id: null,
            z_score: score.z_score,
          })),
        ],
      });
    }

    // ── 9-box computation: performance × potential ──
    const performance_layers = ["COGNITIVE", "EXECUTION", "SJT"];
    const potential_layers = ["PERSONALITY", "LEADERSHIP", "MOTIVATORS"];

    const perf_scores = layer_scores.filter((s) => performance_layers.includes(s.layer_code));
    const pot_scores = layer_scores.filter((s) => potential_layers.includes(s.layer_code));

    const performance_pct = perf_scores.length
      ? perf_scores.reduce((sum, s) => sum + s.normalized_score_0_100, 0) / perf_scores.length
      : role_fit.fit_score_pct;
    const potential_pct = pot_scores.length
      ? pot_scores.reduce((sum, s) => sum + s.normalized_score_0_100, 0) / pot_scores.length
      : role_fit.fit_score_pct;

    const perf_band = performance_pct >= 67 ? "HIGH" : performance_pct >= 33 ? "MODERATE" : "LOW";
    const pot_band = potential_pct >= 67 ? "HIGH" : potential_pct >= 33 ? "MODERATE" : "LOW";
    const nine_box = `${perf_band}_PERFORMANCE_${pot_band}_POTENTIAL` as import("@prisma/client").NineBoxPlacement;

    await transaction.roleFitResult.upsert({
      where: {
        assessment_id_role_family_id: {
          assessment_id: assessment.id,
          role_family_id: assessment.role_family_id,
        },
      },
      create: {
        assessment_id: assessment.id,
        fit_score_pct: role_fit.fit_score_pct,
        recommendation: role_fit.recommendation,
        role_family_id: assessment.role_family_id,
        top_2_constraints: to_nullable_json_input(role_fit.top_2_constraints),
        top_3_drivers: to_nullable_json_input(role_fit.top_3_drivers),
        performance_pct: Math.round(performance_pct * 10) / 10,
        potential_pct: Math.round(potential_pct * 10) / 10,
        nine_box,
      },
      update: {
        fit_score_pct: role_fit.fit_score_pct,
        recommendation: role_fit.recommendation,
        top_2_constraints: to_nullable_json_input(role_fit.top_2_constraints),
        top_3_drivers: to_nullable_json_input(role_fit.top_3_drivers),
        performance_pct: Math.round(performance_pct * 10) / 10,
        potential_pct: Math.round(potential_pct * 10) / 10,
        nine_box,
      },
    });

    await transaction.developmentPlan.deleteMany({
      where: {
        assessment_id: assessment.id,
      },
    });

    if (development_gaps.length) {
      await transaction.developmentPlan.create({
        data: {
          assessment_id: assessment.id,
          gap_dimensions: to_required_json_input(development_gaps),
          status: "ACTIVE",
          user_id: assessment.candidate_id,
        },
      });
    }

    for (const statistic of norm_statistics.values()) {
      await transaction.normStatistic.upsert({
        where: {
          norm_group_id_sub_dimension_id: {
            norm_group_id: norm_group.id,
            sub_dimension_id: statistic.sub_dimension_id,
          },
        },
        create: {
          mean: statistic.mean,
          norm_group_id: norm_group.id,
          percentile_lookup: to_required_json_input({
            scoring_model_version: scoring_model.version_label,
            values: statistic.percentile_lookup,
          }),
          sample_n: statistic.sample_n,
          std_dev: statistic.std_dev,
          sub_dimension_id: statistic.sub_dimension_id,
        },
        update: {
          mean: statistic.mean,
          percentile_lookup: to_required_json_input({
            scoring_model_version: scoring_model.version_label,
            values: statistic.percentile_lookup,
          }),
          sample_n: statistic.sample_n,
          std_dev: statistic.std_dev,
        },
      });
    }

    await transaction.normGroup.update({
      where: { id: norm_group.id },
      data: {
        member_count: await transaction.normGroupMember.count({
          where: {
            deleted_at: null,
            norm_group_id: norm_group.id,
          },
        }),
      },
    });

    await transaction.assessment.update({
      where: { id: assessment.id },
      data: {
        quality_flags: to_nullable_json_input(quality_flags),
        status: assessment.status === AssessmentStatus.COMPLETED ? AssessmentStatus.COMPLETED : assessment.status,
      },
    });

    await transaction.scoringRun.update({
      where: { id: initial_run.id },
      data: {
        completed_at: new Date(),
        status: ScoringRunStatus.COMPLETED,
        step_outputs: to_nullable_json_input(step_outputs),
      },
    });
  });

  const rank_in_cohort =
    1 +
    (await prisma.roleFitResult.count({
      where: {
        deleted_at: null,
        fit_score_pct: {
          gt: role_fit.fit_score_pct,
        },
        role_family_id: assessment.role_family_id,
      },
    }));

  await prisma.roleFitResult.update({
    where: {
      assessment_id_role_family_id: {
        assessment_id: assessment.id,
        role_family_id: assessment.role_family_id,
      },
    },
    data: {
      rank_in_cohort,
    },
  });

  return {
    fit_score_pct: role_fit.fit_score_pct,
    recommendation: role_fit.recommendation,
    run_id: initial_run.id,
    status: ScoringRunStatus.COMPLETED,
    step_outputs,
  };
}

export async function recompute_norm_group_statistics(input: {
  norm_group_id: string;
  scoring_model_version: string;
}) {
  const members = await prisma.normGroupMember.findMany({
    where: {
      deleted_at: null,
      norm_group_id: input.norm_group_id,
    },
  });
  const assessment_ids = members.map((member) => member.assessment_id);

  const scores = await prisma.score.findMany({
    where: {
      assessment_id: {
        in: assessment_ids,
      },
      deleted_at: null,
      scoring_model_version: input.scoring_model_version,
      sub_dimension_id: {
        not: null,
      },
    },
  });
  const grouped = new Map<string, number[]>();

  for (const score of scores) {
    if (!score.sub_dimension_id || score.raw_score === null) {
      continue;
    }

    grouped.set(score.sub_dimension_id, [...(grouped.get(score.sub_dimension_id) ?? []), score.raw_score]);
  }

  for (const [sub_dimension_id, values] of grouped.entries()) {
    const lookup = build_percentile_lookup(values, [5, 10, 25, 50, 75, 90, 95]);
    const mean_score = round_number(mean(values), 4);
    const std_dev = round_number(standard_deviation(values), 4);

    await prisma.normStatistic.upsert({
      where: {
        norm_group_id_sub_dimension_id: {
          norm_group_id: input.norm_group_id,
          sub_dimension_id,
        },
      },
      create: {
        mean: mean_score,
        norm_group_id: input.norm_group_id,
        percentile_lookup: to_required_json_input({
          scoring_model_version: input.scoring_model_version,
          values: lookup,
        }),
        sample_n: values.length,
        std_dev,
        sub_dimension_id,
      },
      update: {
        mean: mean_score,
        percentile_lookup: to_required_json_input({
          scoring_model_version: input.scoring_model_version,
          values: lookup,
        }),
        sample_n: values.length,
        std_dev,
      },
    });
  }

  await prisma.normGroup.update({
    where: { id: input.norm_group_id },
    data: {
      member_count: members.length,
    },
  });
}

export async function build_reliability_snapshot(input: {
  model_version?: string | null;
  org_id: string;
}) {
  const scored_responses = await prisma.scoredResponse.findMany({
    where: {
      deleted_at: null,
      scoring_run: {
        assessment: {
          org_id: input.org_id,
        },
        deleted_at: null,
        status: ScoringRunStatus.COMPLETED,
        ...(input.model_version ? { scoring_model: { version_label: input.model_version } } : {}),
      },
    },
    include: {
      response: {
        select: {
          assessment_id: true,
        },
      },
      item: {
        include: {
          assessment_layer: true,
          sub_dimension: true,
        },
      },
    },
  });
  const grouped = new Map<
    string,
    {
      assessment_ids: Set<string>;
      layer_code: AssessmentLayerCode;
      rows: Map<string, number[]>;
      sub_dimension_id: string;
      sub_dimension_name: string;
    }
  >();

  for (const scored_response of scored_responses) {
    const sub_dimension_id = scored_response.item.sub_dimension_id ?? extract_personality_sub_dimension_id(scored_response.explanation);
    const sub_dimension_name = scored_response.item.sub_dimension?.name ?? extract_personality_sub_dimension_name(scored_response.explanation);

    if (!sub_dimension_id || !sub_dimension_name) {
      continue;
    }

    const current =
      grouped.get(sub_dimension_id) ??
      {
        assessment_ids: new Set<string>(),
        layer_code: scored_response.item.assessment_layer.code,
        rows: new Map<string, number[]>(),
        sub_dimension_id,
        sub_dimension_name,
      };
    const row = current.rows.get(scored_response.response.assessment_id) ?? [];

    if (scored_response.scored_value !== null) {
      row.push(scored_response.scored_value);
    } else {
      for (const contribution of extract_personality_trait_contributions(scored_response.explanation)) {
        if (contribution.sub_dimension_name === sub_dimension_name) {
          row.push(contribution.raw_score);
        }
      }
    }

    current.rows.set(scored_response.response.assessment_id, row);
    current.assessment_ids.add(scored_response.response.assessment_id);
    grouped.set(sub_dimension_id, current);
  }

  return Array.from(grouped.values())
    .map((entry) => {
      const matrix = pad_rows_to_max_length(Array.from(entry.rows.values()));

      return {
        alpha: calculate_cronbach_alpha(matrix),
        layer_code: entry.layer_code,
        respondent_count: entry.assessment_ids.size,
        sub_dimension_id: entry.sub_dimension_id,
        sub_dimension_name: entry.sub_dimension_name,
      };
    })
    .sort((left, right) => left.sub_dimension_name.localeCompare(right.sub_dimension_name));
}

async function build_layer_scores(input: {
  assessment_id: string;
  assessment_org_id: string;
  assessment_role_family_name: string;
  assessment_version_config: Record<string, unknown>;
  config: ReturnType<typeof normalize_scoring_model_config>;
  construct_scores: Array<ConstructScore & { normalized_score_0_100: number }>;
  engine_mode: ScoringEngineMode;
  peer_items: ScoredItemResult[];
  scored_items: ScoredItemResult[];
}) {
  const constructs_by_layer = group_constructs_by_layer(input.construct_scores);
  const cognitive_phase_b = input.engine_mode === "PHASE_B_HYBRID_IRT" ? build_cognitive_phase_b_summary(input.scored_items, input.config) : null;
  const archetypes = build_motivation_archetypes(input.scored_items);
  const candidate_items =
    cognitive_phase_b && input.config.cat.enabled
      ? await prisma.item.findMany({
          where: {
            deleted_at: null,
            is_active: true,
            assessment_layer: {
              code: "COGNITIVE",
            },
          },
          select: {
            difficulty_b: true,
            discrimination_a: true,
            exposure_count: true,
            guessing_c: true,
            id: true,
          },
        })
      : [];
  const next_cat_item =
    cognitive_phase_b && input.config.cat.enabled
      ? select_next_cat_item(
          cognitive_phase_b.theta,
          candidate_items.map((item) => ({
            a: item.discrimination_a ?? 1,
            b: item.difficulty_b ?? 0,
            c: item.guessing_c ?? 0.2,
            exposure_count: item.exposure_count,
            id: item.id,
          })),
          input.scored_items.filter((item) => item.layer_code === "COGNITIVE").map((item) => item.item_id),
          input.config.cat.exposure_penalty_pct,
        )
      : null;

  return (["COGNITIVE", "PERSONALITY", "MOTIVATORS", "EXECUTION", "LEADERSHIP", "SJT"] as const).map((layer_code) => {
    const constructs = constructs_by_layer.get(layer_code) ?? [];

    if (layer_code === "COGNITIVE") {
      const normalized_score = cognitive_phase_b ? cognitive_phase_b.percentile : round_number(mean(constructs.map((entry) => entry.normalized_score_0_100)), 2);
      return {
        explanation: cognitive_phase_b
          ? `3PL theta ${cognitive_phase_b.theta}, SE ${cognitive_phase_b.standard_error}, CAT next item ${next_cat_item?.id ?? "n/a"}`
          : "Classical cognitive aggregation from scored sub-dimensions.",
        included_in_role_fit: true,
        layer_code,
        normalized_score_0_100: normalized_score,
        percentile: cognitive_phase_b ? cognitive_phase_b.percentile : round_number(mean(constructs.map((entry) => entry.percentile ?? entry.normalized_score_0_100)), 2),
        raw_score: cognitive_phase_b ? cognitive_phase_b.theta : round_number(mean(constructs.map((entry) => entry.raw_score)), 4),
        z_score: cognitive_phase_b ? cognitive_phase_b.theta : round_number(mean(constructs.map((entry) => entry.z_score ?? 0)), 4),
      } satisfies LayerScore;
    }

    if (layer_code === "EXECUTION") {
      const self_score = round_number(
        mean(
          input.scored_items
            .filter((item) => item.layer_code === "EXECUTION" && extract_item_type(item.explanation) === "LIKERT")
            .map((item) => item.scored_value ?? 0),
        ),
        2,
      );
      const scenario_score = round_number(
        mean(
          input.scored_items
            .filter((item) => item.layer_code === "EXECUTION" && extract_item_type(item.explanation) === "SCENARIO")
            .map((item) => item.scored_value ?? 0),
        ),
        2,
      );
      const total_weight = input.config.execution.self_report_weight_pct + input.config.execution.scenario_weight_pct || 1;
      const normalized_score = round_number(
        self_score * (input.config.execution.self_report_weight_pct / total_weight) +
          scenario_score * (input.config.execution.scenario_weight_pct / total_weight),
        2,
      );

      return {
        explanation: `Execution Reliability Index = self ${self_score} @ ${input.config.execution.self_report_weight_pct}% + scenario ${scenario_score} @ ${input.config.execution.scenario_weight_pct}%`,
        included_in_role_fit: true,
        layer_code,
        normalized_score_0_100: normalized_score,
        percentile: round_number(mean(constructs.map((entry) => entry.percentile ?? entry.normalized_score_0_100)), 2),
        raw_score: normalized_score,
        z_score: round_number(mean(constructs.map((entry) => entry.z_score ?? 0)), 4),
      } satisfies LayerScore;
    }

    if (layer_code === "LEADERSHIP") {
      const self_score = round_number(
        mean(input.scored_items.filter((item) => item.layer_code === "LEADERSHIP").map((item) => item.scored_value ?? 0)),
        2,
      );
      const peer_score = round_number(mean(input.peer_items.filter((item) => item.layer_code === "LEADERSHIP").map((item) => item.scored_value ?? 0)), 2);
      const use_peer = input.peer_items.some((item) => item.layer_code === "LEADERSHIP");
      const total_weight = use_peer ? input.config.leadership.self_weight_pct + input.config.leadership.peer_weight_pct : 100;
      const normalized_score = use_peer
        ? round_number(
            self_score * (input.config.leadership.self_weight_pct / total_weight) +
              peer_score * (input.config.leadership.peer_weight_pct / total_weight),
            2,
          )
        : self_score;

      return {
        explanation: use_peer
          ? `Leadership Influence Index = self ${self_score} + peer ${peer_score}.`
          : "Leadership Influence Index uses self-report only until 360 data is available.",
        included_in_role_fit: true,
        layer_code,
        normalized_score_0_100: normalized_score,
        percentile: round_number(mean(constructs.map((entry) => entry.percentile ?? entry.normalized_score_0_100)), 2),
        raw_score: normalized_score,
        z_score: round_number(mean(constructs.map((entry) => entry.z_score ?? 0)), 4),
      } satisfies LayerScore;
    }

    if (layer_code === "MOTIVATORS") {
      return {
        explanation: `Motivation Archetype top cluster: ${archetypes[0]?.archetype ?? "n/a"}.`,
        included_in_role_fit: false,
        layer_code,
        normalized_score_0_100: round_number(mean(constructs.map((entry) => entry.normalized_score_0_100)), 2),
        percentile: round_number(mean(constructs.map((entry) => entry.percentile ?? entry.normalized_score_0_100)), 2),
        raw_score: round_number(mean(constructs.map((entry) => entry.raw_score)), 4),
        z_score: round_number(mean(constructs.map((entry) => entry.z_score ?? 0)), 4),
      } satisfies LayerScore;
    }

    if (layer_code === "PERSONALITY") {
      return {
        explanation:
          input.engine_mode === "PHASE_B_HYBRID_IRT"
            ? "Personality Vector uses Thurstonian latent utilities and is eligible for inter-person comparison."
            : "Personality Vector uses forced-choice rank scoring and remains within-person only.",
        included_in_role_fit: input.engine_mode === "PHASE_B_HYBRID_IRT" && input.assessment_version_config.personality_hiring_allowed !== false,
        layer_code,
        normalized_score_0_100: round_number(mean(constructs.map((entry) => entry.normalized_score_0_100)), 2),
        percentile: round_number(mean(constructs.map((entry) => entry.percentile ?? entry.normalized_score_0_100)), 2),
        raw_score: round_number(mean(constructs.map((entry) => entry.raw_score)), 4),
        z_score: round_number(mean(constructs.map((entry) => entry.z_score ?? 0)), 4),
      } satisfies LayerScore;
    }

    if (layer_code === "SJT") {
      return {
        explanation: "Decision Index derived from scenario judgment quality.",
        included_in_role_fit: true,
        layer_code,
        normalized_score_0_100: round_number(mean(constructs.map((entry) => entry.normalized_score_0_100)), 2),
        percentile: round_number(mean(constructs.map((entry) => entry.percentile ?? entry.normalized_score_0_100)), 2),
        raw_score: round_number(mean(constructs.map((entry) => entry.raw_score)), 4),
        z_score: round_number(mean(constructs.map((entry) => entry.z_score ?? 0)), 4),
      } satisfies LayerScore;
    }

    return {
      explanation: "Layer score derived from constituent construct scores.",
      included_in_role_fit: true,
      layer_code,
      normalized_score_0_100: round_number(mean(constructs.map((entry) => entry.normalized_score_0_100)), 2),
      percentile: round_number(mean(constructs.map((entry) => entry.percentile ?? entry.normalized_score_0_100)), 2),
      raw_score: round_number(mean(constructs.map((entry) => entry.raw_score)), 4),
      z_score: round_number(mean(constructs.map((entry) => entry.z_score ?? 0)), 4),
    } satisfies LayerScore;
  });
}

async function build_step_outputs(input: {
  assessment_id: string;
  config: ReturnType<typeof normalize_scoring_model_config>;
  development_gaps: DevelopmentGap[];
  engine_mode: ScoringEngineMode;
  layer_scores: LayerScore[];
  quality_flags: ResponseQualityFlag[];
  reliable_construct_scores: Array<ConstructScore & { normalized_score_0_100: number }>;
  role_fit: ReturnType<typeof compute_role_fit>;
  scored_items: ScoredItemResult[];
}) {
  const motivator_archetypes = build_motivation_archetypes(input.scored_items);

  return {
    construct_scores: input.reliable_construct_scores.map((score) => ({
      comparability: score.comparability,
      explanation: score.explanation,
      layer_code: score.layer_code,
      normalized_score_0_100: score.normalized_score_0_100,
      percentile: score.percentile,
      raw_score: score.raw_score,
      reliability_alpha: score.reliability_alpha,
      sub_dimension_name: score.sub_dimension_name,
    })),
    development_plan: input.development_gaps,
    indices: {
      cognitive_index: input.layer_scores.find((score) => score.layer_code === "COGNITIVE")?.normalized_score_0_100 ?? null,
      decision_index: input.layer_scores.find((score) => score.layer_code === "SJT")?.normalized_score_0_100 ?? null,
      execution_reliability_index: input.layer_scores.find((score) => score.layer_code === "EXECUTION")?.normalized_score_0_100 ?? null,
      leadership_influence_index: input.layer_scores.find((score) => score.layer_code === "LEADERSHIP")?.normalized_score_0_100 ?? null,
      motivation_archetype: motivator_archetypes.slice(0, 3),
      personality_vector: input.reliable_construct_scores
        .filter((score) => score.layer_code === "PERSONALITY")
        .map((score) => ({
          percentile: score.percentile,
          score_0_100: score.normalized_score_0_100,
          sub_dimension_name: score.sub_dimension_name,
        })),
    },
    layer_scores: input.layer_scores,
    permissible_use: {
      excluded_layers: input.role_fit.excluded_layers,
      included_layers: input.role_fit.included_layers,
      motivation_allowed_for_hiring: input.config.permissible_use.motivation_allowed_for_hiring,
      personality_requires_phase_b_for_hiring: input.config.permissible_use.personality_requires_phase_b_for_hiring,
    },
    phase: input.engine_mode,
    quality_flags: input.quality_flags,
    role_fit: input.role_fit,
    section_scores: input.layer_scores.map((layer_score) => ({
      explanation: layer_score.explanation,
      layer_code: layer_score.layer_code,
      score_0_100: layer_score.normalized_score_0_100,
    })),
  };
}

async function attach_reliability_estimates(input: {
  assessment_id: string;
  construct_scores: Array<ConstructScore & { normalized_score_0_100: number }>;
  scoring_model_id: string;
  scored_items: ScoredItemResult[];
}) {
  const current_map = build_current_reliability_rows(input.scored_items, input.construct_scores);
  const historical_rows = await prisma.scoredResponse.findMany({
    where: {
      deleted_at: null,
      scoring_run: {
        assessment_id: {
          not: input.assessment_id,
        },
        deleted_at: null,
        scoring_model_id: input.scoring_model_id,
        status: ScoringRunStatus.COMPLETED,
      },
    },
    include: {
      response: {
        select: {
          assessment_id: true,
        },
      },
      item: {
        include: {
          sub_dimension: true,
        },
      },
    },
  });
  const grouped = new Map<string, Map<string, number[]>>();

  for (const row of historical_rows) {
    const sub_dimension_id = row.item.sub_dimension_id ?? extract_personality_sub_dimension_id(row.explanation);

    if (!sub_dimension_id) {
      continue;
    }

    const current = grouped.get(sub_dimension_id) ?? new Map<string, number[]>();
    const values = current.get(row.response.assessment_id) ?? [];

    if (row.scored_value !== null) {
      values.push(row.scored_value);
    } else {
      for (const contribution of extract_personality_trait_contributions(row.explanation)) {
        if (contribution.sub_dimension_id === sub_dimension_id || contribution.sub_dimension_name === row.item.sub_dimension?.name) {
          values.push(contribution.raw_score);
        }
      }
    }

    current.set(row.response.assessment_id, values);
    grouped.set(sub_dimension_id, current);
  }

  for (const [sub_dimension_id, row_values] of current_map.entries()) {
    const existing = grouped.get(sub_dimension_id) ?? new Map<string, number[]>();
    existing.set(input.assessment_id, row_values);
    grouped.set(sub_dimension_id, existing);
  }

  return input.construct_scores.map((score) => {
    const rows = Array.from(grouped.get(score.sub_dimension_id)?.values() ?? []);
    const alpha = calculate_cronbach_alpha(pad_rows_to_max_length(rows));
    return {
      ...score,
      reliability_alpha: alpha,
    };
  });
}

async function build_norm_statistics(input: {
  assessment_id: string;
  constructs: RawConstructScore[];
  norm_group_id: string;
  percentile_breakpoints: number[];
  scoring_model_version: string;
}) {
  const members = await prisma.normGroupMember.findMany({
    where: {
      deleted_at: null,
      norm_group_id: input.norm_group_id,
    },
  });
  const member_assessment_ids = members.map((member) => member.assessment_id).filter((assessment_id) => assessment_id !== input.assessment_id);
  const historical_scores = await prisma.score.findMany({
    where: {
      assessment_id: {
        in: member_assessment_ids,
      },
      deleted_at: null,
      scoring_model_version: input.scoring_model_version,
      sub_dimension_id: {
        not: null,
      },
    },
  });
  const grouped = new Map<string, number[]>();

  for (const score of historical_scores) {
    if (!score.sub_dimension_id || score.raw_score === null) {
      continue;
    }

    grouped.set(score.sub_dimension_id, [...(grouped.get(score.sub_dimension_id) ?? []), score.raw_score]);
  }

  for (const construct of input.constructs) {
    grouped.set(construct.sub_dimension_id, [...(grouped.get(construct.sub_dimension_id) ?? []), construct.raw_score]);
  }

  return new Map(
    Array.from(grouped.entries()).map(([sub_dimension_id, values]) => {
      const statistic = {
        mean: round_number(mean(values), 4),
        percentile_lookup: build_percentile_lookup(values, input.percentile_breakpoints),
        sample_n: values.length,
        std_dev: round_number(standard_deviation(values), 4),
        sub_dimension_id,
      } satisfies NormStatisticSeed;

      return [sub_dimension_id, statistic];
    }),
  );
}

async function ensure_default_norm_group(org_id: string, default_name: string) {
  const existing = await prisma.normGroup.findFirst({
    where: {
      deleted_at: null,
      name: default_name,
      org_id,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.normGroup.create({
    data: {
      description: "Auto-maintained norm group for the active scoring engine.",
      name: default_name,
      org_id,
    },
  });
}

function build_raw_construct_scores(input: {
  config: ReturnType<typeof normalize_scoring_model_config>;
  engine_mode: ScoringEngineMode;
  personality_lookup: Map<
    string,
    { id: string; name: string; assessment_layer: { code: AssessmentLayerCode } }
  >;
  scored_items: ScoredItemResult[];
}) {
  const grouped = new Map<
    string,
    {
      comparability: ScoreComparability;
      explanation: string;
      layer_code: AssessmentLayerCode;
      raw_score_max: number;
      raw_score_min: number;
      scores: number[];
      sub_dimension_id: string;
      sub_dimension_name: string;
    }
  >();
  const personality_blocks: Array<{ least_trait: string; most_trait: string; traits: string[] }> = [];

  for (const scored_item of input.scored_items) {
    if (scored_item.layer_code !== "PERSONALITY") {
      for (const contribution of scored_item.construct_contributions) {
        const existing =
          grouped.get(contribution.sub_dimension_id) ??
          {
            comparability: "INTER_PERSON" as const,
            explanation: "Construct score aggregated from scored responses.",
            layer_code: contribution.layer_code,
            raw_score_max: 100,
            raw_score_min: 0,
            scores: [],
            sub_dimension_id: contribution.sub_dimension_id,
            sub_dimension_name: contribution.sub_dimension_name,
          };
        existing.scores.push(contribution.raw_score);
        grouped.set(contribution.sub_dimension_id, existing);
      }
      continue;
    }

    const triad_explanation = as_record(scored_item.explanation) ?? {};
    const most_trait = as_string(triad_explanation.most);
    const least_trait = as_string(triad_explanation.least);
    const contributions = extract_personality_trait_contributions(scored_item.explanation);

    if (most_trait && least_trait && contributions.length) {
      personality_blocks.push({
        least_trait,
        most_trait,
        traits: contributions.map((entry) => entry.sub_dimension_name),
      });
    }

    if (input.engine_mode === "PHASE_A_CLASSICAL") {
      for (const contribution of contributions) {
        const sub_dimension = input.personality_lookup.get(contribution.sub_dimension_name);

        if (!sub_dimension) {
          continue;
        }

        const existing =
          grouped.get(sub_dimension.id) ??
          {
            comparability: "WITHIN_PERSON_ONLY" as const,
            explanation: "Phase A personality scores are within-person only until Thurstonian IRT is enabled.",
            layer_code: "PERSONALITY" as const,
            raw_score_max: 100,
            raw_score_min: 0,
            scores: [],
            sub_dimension_id: sub_dimension.id,
            sub_dimension_name: sub_dimension.name,
          };
        existing.scores.push(contribution.raw_score);
        grouped.set(sub_dimension.id, existing);
      }
    }
  }

  const scores: RawConstructScore[] = Array.from(grouped.values()).map((entry) => ({
    comparability: entry.comparability,
    explanation: entry.explanation,
    layer_code: entry.layer_code,
    percentile_hint: null,
    raw_score: round_number(mean(entry.scores), 4),
    raw_score_max: entry.raw_score_max,
    raw_score_min: entry.raw_score_min,
    sub_dimension_id: entry.sub_dimension_id,
    sub_dimension_name: entry.sub_dimension_name,
    z_score_hint: null,
  }));

  if (input.engine_mode === "PHASE_B_HYBRID_IRT" && personality_blocks.length) {
    const vector = estimate_thurstonian_vector(personality_blocks);

    for (const [trait, result] of Object.entries(vector)) {
      const sub_dimension = input.personality_lookup.get(trait);

      if (!sub_dimension) {
        continue;
      }

      scores.push({
        comparability: "INTER_PERSON",
        explanation: "Thurstonian personality utility estimated from most-least blocks.",
        layer_code: "PERSONALITY",
        percentile_hint: result.percentile,
        raw_score: result.theta,
        raw_score_max: input.config.irt.theta_max,
        raw_score_min: input.config.irt.theta_min,
        sub_dimension_id: sub_dimension.id,
        sub_dimension_name: sub_dimension.name,
        z_score_hint: result.theta,
      });
    }
  }

  return scores.sort((left, right) => left.sub_dimension_name.localeCompare(right.sub_dimension_name));
}

function build_current_reliability_rows(
  scored_items: ScoredItemResult[],
  construct_scores: Array<ConstructScore & { normalized_score_0_100: number }>,
) {
  const construct_lookup = new Map(construct_scores.map((score) => [score.sub_dimension_name, score.sub_dimension_id]));
  const grouped = new Map<string, number[]>();

  for (const scored_item of scored_items) {
    if (scored_item.layer_code === "PERSONALITY") {
      for (const contribution of extract_personality_trait_contributions(scored_item.explanation)) {
        const sub_dimension_id = contribution.sub_dimension_id ?? construct_lookup.get(contribution.sub_dimension_name);

        if (!sub_dimension_id) {
          continue;
        }

        grouped.set(sub_dimension_id, [...(grouped.get(sub_dimension_id) ?? []), contribution.raw_score]);
      }

      continue;
    }

    if (scored_item.sub_dimension_id && scored_item.scored_value !== null) {
      grouped.set(scored_item.sub_dimension_id, [...(grouped.get(scored_item.sub_dimension_id) ?? []), scored_item.scored_value]);
    }
  }

  return grouped;
}

function build_cognitive_phase_b_summary(
  scored_items: ScoredItemResult[],
  config: ReturnType<typeof normalize_scoring_model_config>,
) {
  const responses = scored_items
    .filter((item) => item.layer_code === "COGNITIVE")
    .map((item) => ({
      a: as_number(as_record(item.explanation)?.discrimination_a) ?? 1.05,
      b: as_number(as_record(item.explanation)?.difficulty_b) ?? 0,
      c: as_number(as_record(item.explanation)?.guessing_c) ?? 0.2,
      is_correct: as_record(item.explanation)?.is_correct === true ? (1 as const) : (0 as const),
    }));

  if (!responses.length) {
    return null;
  }

  const theta = estimate_theta_3pl(responses, config.irt);

  return {
    percentile: round_number(Math.max(Math.min((0.5 + theta.theta / 8) * 100, 100), 0), 2),
    standard_error: theta.standard_error ?? null,
    theta: theta.theta,
  };
}

function build_motivation_archetypes(scored_items: ScoredItemResult[]) {
  const grouped = new Map<string, number[]>();

  for (const item of scored_items.filter((entry) => entry.layer_code === "MOTIVATORS")) {
    const archetype = as_string(as_record(item.explanation)?.archetype_cluster_hint);

    if (!archetype || item.scored_value === null) {
      continue;
    }

    grouped.set(archetype, [...(grouped.get(archetype) ?? []), item.scored_value]);
  }

  return Array.from(grouped.entries())
    .map(([archetype, values]) => ({
      archetype,
      score_0_100: round_number(mean(values), 2),
    }))
    .sort((left, right) => right.score_0_100 - left.score_0_100);
}

function resolve_role_fit_layers(input: {
  assessment_version_config: Record<string, unknown>;
  config: ReturnType<typeof normalize_scoring_model_config>;
  engine_mode: ScoringEngineMode;
  role_family_name: string;
}) {
  const layers: AssessmentLayerCode[] = ["COGNITIVE", "EXECUTION", "SJT"];
  const allow_personality =
    (!input.config.permissible_use.personality_requires_phase_b_for_hiring || input.engine_mode === "PHASE_B_HYBRID_IRT") &&
    input.assessment_version_config.personality_hiring_allowed !== false;

  if (allow_personality) {
    layers.push("PERSONALITY");
  }

  if (!input.config.permissible_use.leadership_requires_senior_role || is_senior_role_family(input.role_family_name, input.config.leadership.senior_role_keywords)) {
    layers.push("LEADERSHIP");
  }

  if (input.config.permissible_use.motivation_allowed_for_hiring) {
    layers.push("MOTIVATORS");
  }

  return layers;
}

function serialize_response(response: {
  assessment_id: string;
  id: string;
  item: {
    assessment_layer: { code: AssessmentLayerCode };
    difficulty_b: number | null;
    discrimination_a: number | null;
    guessing_c: number | null;
    id: string;
    item_options: Array<{ display_order: number; is_correct: boolean; option_text: string; score_weight: number }>;
    item_type: ScoringResponse["item"]["item_type"];
    layer_id: string;
    options: Prisma.JsonValue;
    scoring_key: Prisma.JsonValue;
    stem: string;
    sub_dimension: { id: string; name: string } | null;
    time_limit_seconds: number | null;
  };
  response_time_seconds: number | null;
  response_value: unknown;
  sequence_number: number;
}): ScoringResponse {
  return {
    assessment_id: response.assessment_id,
    id: response.id,
    item: {
      difficulty_b: response.item.difficulty_b,
      discrimination_a: response.item.discrimination_a,
      guessing_c: response.item.guessing_c,
      id: response.item.id,
      item_type: response.item.item_type,
      layer_code: response.item.assessment_layer.code,
      options: normalize_item_options(response.item.options, response.item.item_options).map((option, index) => ({
        display_order: option.display_order ?? index + 1,
        is_correct: option.is_correct,
        option_text: option.option_text,
        score_weight: option.score_weight,
        trait: option.trait,
      })),
      scoring_key: as_record(response.item.scoring_key),
      stem: response.item.stem,
      sub_dimension_id: response.item.sub_dimension?.id ?? null,
      sub_dimension_name: response.item.sub_dimension?.name ?? null,
      time_limit_seconds: response.item.time_limit_seconds,
    },
    response_time_seconds: response.response_time_seconds,
    response_value: response.response_value,
    sequence_number: response.sequence_number,
  };
}

function serialize_item(item: {
  assessment_layer: { code: AssessmentLayerCode };
  difficulty_b: number | null;
  discrimination_a: number | null;
  guessing_c: number | null;
  id: string;
  item_options: Array<{ display_order: number; is_correct: boolean; option_text: string; score_weight: number }>;
  item_type: ScoringResponse["item"]["item_type"];
  options: Prisma.JsonValue;
  scoring_key: Prisma.JsonValue;
  stem: string;
  sub_dimension: { id: string; name: string } | null;
  time_limit_seconds: number | null;
}) {
  return {
    difficulty_b: item.difficulty_b,
    discrimination_a: item.discrimination_a,
    guessing_c: item.guessing_c,
    id: item.id,
    item_type: item.item_type,
    layer_code: item.assessment_layer.code,
    options: normalize_item_options(item.options, item.item_options).map((option, index) => ({
      display_order: option.display_order ?? index + 1,
      is_correct: option.is_correct,
      option_text: option.option_text,
      score_weight: option.score_weight,
      trait: option.trait,
    })),
    scoring_key: as_record(item.scoring_key),
    stem: item.stem,
    sub_dimension_id: item.sub_dimension?.id ?? null,
    sub_dimension_name: item.sub_dimension?.name ?? null,
    time_limit_seconds: item.time_limit_seconds,
  };
}

function dedupe_quality_flags(flags: ResponseQualityFlag[]) {
  const unique = new Map<string, ResponseQualityFlag>();

  for (const flag of flags) {
    unique.set(JSON.stringify(flag), flag);
  }

  return Array.from(unique.values());
}

function normalize_existing_quality_flags(value: unknown) {
  return as_array(value)
    .map((entry) => as_record(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map(
      (entry) =>
        ({
          count: as_number(entry.count) ?? undefined,
          detail: as_string(entry.detail) ?? undefined,
          item_id: as_string(entry.item_id) ?? undefined,
          reason: (as_string(entry.reason) ?? "speed_anomaly") as ResponseQualityFlag["reason"],
          response_time_seconds: as_number(entry.response_time_seconds) ?? undefined,
          value: as_number(entry.value) ?? as_string(entry.value) ?? undefined,
        }) satisfies ResponseQualityFlag,
    );
}

function to_nullable_json_input(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function to_required_json_input(value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function group_constructs_by_layer(construct_scores: Array<ConstructScore & { normalized_score_0_100: number }>) {
  const grouped = new Map<AssessmentLayerCode, Array<ConstructScore & { normalized_score_0_100: number }>>();

  for (const score of construct_scores) {
    grouped.set(score.layer_code, [...(grouped.get(score.layer_code) ?? []), score]);
  }

  return grouped;
}

function normalize_weight_matrix(value: unknown) {
  const record = as_record(value) ?? {};

  return {
    COGNITIVE: as_number(record.COGNITIVE) ?? 0,
    EXECUTION: as_number(record.EXECUTION) ?? 0,
    LEADERSHIP: as_number(record.LEADERSHIP) ?? 0,
    MOTIVATORS: as_number(record.MOTIVATORS) ?? 0,
    PERSONALITY: as_number(record.PERSONALITY) ?? 0,
    SJT: as_number(record.SJT) ?? 0,
  } satisfies Partial<Record<AssessmentLayerCode, number>>;
}

function is_senior_role_family(role_family_name: string, keywords: string[]) {
  return keywords.some((keyword) => role_family_name.toLowerCase().includes(keyword.toLowerCase()));
}

function get_layer_id_from_responses(
  responses: Array<{
    item: {
      assessment_layer: { code: AssessmentLayerCode };
      layer_id: string;
    };
  }>,
  layer_code: AssessmentLayerCode,
) {
  const match = responses.find((response) => response.item.assessment_layer.code === layer_code);

  if (!match) {
    throw new Error(`Unable to resolve layer id for ${layer_code}.`);
  }

  return match.item.layer_id;
}

function extract_personality_trait_contributions(explanation: unknown) {
  return as_array(as_record(explanation)?.trait_contributions)
    .map((entry) => as_record(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      raw_score: as_number(entry.raw_score) ?? 50,
      sub_dimension_id: as_string(entry.sub_dimension_id) ?? null,
      sub_dimension_name: as_string(entry.sub_dimension_name) ?? "Unknown",
    }));
}

function extract_personality_sub_dimension_id(explanation: unknown) {
  return as_string(as_record(explanation)?.sub_dimension_id);
}

function extract_personality_sub_dimension_name(explanation: unknown) {
  return as_string(as_record(explanation)?.sub_dimension_name);
}

function extract_item_type(explanation: unknown) {
  const record = as_record(explanation);

  if (record?.model === "likert_reverse_coded") {
    return "LIKERT";
  }

  if (record?.model === "partial_credit_0_4") {
    return "SCENARIO";
  }

  return "UNKNOWN";
}

function pad_rows_to_max_length(rows: number[][]) {
  const max_length = Math.max(...rows.map((row) => row.length), 0);

  return rows
    .filter((row) => row.length > 1)
    .map((row) => {
      const row_mean = row.length ? mean(row) : 0;
      const padded = [...row];

      while (padded.length < max_length) {
        padded.push(row_mean);
      }

      return padded;
    });
}
