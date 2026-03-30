import type { AssessmentLayerCode, RoleFitRecommendation } from "@prisma/client";
import { min_max_normalize, percentile_from_z_score, z_score } from "@/lib/scoring/math";
import type {
  ConstructScore,
  DevelopmentGap,
  LayerScore,
  RoleFitComputation,
  RoleFitDriver,
  ScoreRange,
  ScoringModelConfig,
} from "@/lib/scoring/types";
import { round_number } from "@/lib/scoring/utils";

export function normalize_construct_score(input: {
  comparability: ConstructScore["comparability"];
  norm_mean?: number | null;
  norm_std_dev?: number | null;
  phase: "PHASE_A_CLASSICAL" | "PHASE_B_HYBRID_IRT";
  raw_score: number;
  raw_score_max?: number;
  raw_score_min?: number;
}) {
  const z = input.norm_mean !== undefined && input.norm_std_dev !== undefined ? z_score(input.raw_score, input.norm_mean ?? 0, input.norm_std_dev ?? 0) : 0;
  const percentile = round_number(percentile_from_z_score(z), 2);
  const normalized =
    input.phase === "PHASE_B_HYBRID_IRT" && input.comparability === "INTER_PERSON"
      ? percentile
      : round_number(min_max_normalize(input.raw_score, input.raw_score_min ?? 0, input.raw_score_max ?? 100), 2);

  return {
    normalized_score_0_100: normalized,
    percentile,
    z_score: round_number(z, 4),
  };
}

export function aggregate_weighted_layer_score(
  layer_code: AssessmentLayerCode,
  components: Array<{ label: string; score: number; weight_pct: number }>,
  included_in_role_fit: boolean,
) {
  const total_weight = components.reduce((sum, component) => sum + component.weight_pct, 0) || 1;
  const raw_score = components.reduce((sum, component) => sum + component.score * (component.weight_pct / total_weight), 0);
  const explanation = components.map((component) => `${component.label}: ${round_number(component.score, 2)} @ ${component.weight_pct}%`).join(" | ");

  return {
    explanation,
    included_in_role_fit,
    layer_code,
    normalized_score_0_100: round_number(raw_score, 2),
    percentile: null,
    raw_score: round_number(raw_score, 2),
    z_score: null,
  } satisfies LayerScore;
}

export function get_role_fit_recommendation(score: number, thresholds: ScoringModelConfig["fit_thresholds"]): RoleFitRecommendation {
  if (score >= thresholds.strong_fit_min) {
    return "STRONG_FIT";
  }

  if (score >= thresholds.fit_min) {
    return "FIT";
  }

  if (score >= thresholds.develop_min) {
    return "DEVELOP";
  }

  return "POOR_FIT";
}

export function compute_role_fit(input: {
  ideal_ranges: Partial<Record<AssessmentLayerCode, ScoreRange>>;
  included_layers: AssessmentLayerCode[];
  layer_scores: Record<AssessmentLayerCode, number>;
  thresholds: ScoringModelConfig["fit_thresholds"];
  weight_matrix: Partial<Record<AssessmentLayerCode, number>>;
}) {
  const drivers: RoleFitDriver[] = [];

  for (const layer_code of input.included_layers) {
    const score = input.layer_scores[layer_code] ?? 0;
    const weight = input.weight_matrix[layer_code] ?? 0;
    const ideal_range = input.ideal_ranges[layer_code] ?? null;
    const gap_to_ideal = calculate_gap_to_ideal(score, ideal_range);
    const adjusted_score = Math.max(score - gap_to_ideal, 0);
    drivers.push({
      adjusted_score: round_number(adjusted_score, 2),
      gap_to_ideal: round_number(gap_to_ideal, 2),
      ideal_range,
      label: layer_code.replaceAll("_", " "),
      layer_code,
      weighted_contribution: round_number(adjusted_score * (weight / 100), 2),
    });
  }

  const total_weight = drivers.reduce((sum, driver) => sum + (input.weight_matrix[driver.layer_code] ?? 0), 0) || 1;
  const fit_score_pct = round_number((drivers.reduce((sum, driver) => sum + driver.weighted_contribution, 0) / total_weight) * 100, 2);

  return {
    excluded_layers: Object.keys(input.layer_scores).filter(
      (layer_code): layer_code is AssessmentLayerCode => !input.included_layers.includes(layer_code as AssessmentLayerCode),
    ),
    fit_score_pct,
    included_layers: input.included_layers,
    recommendation: get_role_fit_recommendation(fit_score_pct, input.thresholds),
    top_2_constraints: [...drivers].sort((left, right) => right.gap_to_ideal - left.gap_to_ideal).slice(0, 2),
    top_3_drivers: [...drivers].sort((left, right) => right.weighted_contribution - left.weighted_contribution).slice(0, 3),
  } satisfies RoleFitComputation;
}

export function build_development_gaps(input: {
  construct_scores: Array<{
    normalized_score_0_100: number;
    percentile: number | null;
    recommendation_texts: string[];
    sub_dimension_id: string;
    sub_dimension_name: string;
  }>;
  gap_percentile_threshold: number;
  high_stakes_gap_threshold: number;
}) {
  const threshold = input.gap_percentile_threshold;

  return input.construct_scores
    .filter((score) => (score.percentile ?? score.normalized_score_0_100) < threshold)
    .map(
      (score) =>
        ({
          high_stakes_gap: (score.percentile ?? score.normalized_score_0_100) < input.high_stakes_gap_threshold,
          percentile: score.percentile,
          recommendation_texts: score.recommendation_texts,
          score_0_100: score.normalized_score_0_100,
          sub_dimension_id: score.sub_dimension_id,
          sub_dimension_name: score.sub_dimension_name,
        }) satisfies DevelopmentGap,
    )
    .sort((left, right) => left.score_0_100 - right.score_0_100);
}

function calculate_gap_to_ideal(score: number, ideal_range: ScoreRange | null) {
  if (!ideal_range) {
    return Math.max(0, 50 - score) / 2;
  }

  if (score < ideal_range.min) {
    return ideal_range.min - score;
  }

  if (score > ideal_range.max) {
    return score - ideal_range.max;
  }

  return 0;
}
