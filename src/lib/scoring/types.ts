import type { AssessmentLayerCode, ItemType, RoleFitRecommendation } from "@prisma/client";

export type ScoreRange = {
  max: number;
  min: number;
};

export type ScoreComparability = "INTER_PERSON" | "WITHIN_PERSON_ONLY";

export type ResponseQualityFlagReason =
  | "disengagement"
  | "extreme_responding"
  | "speed_anomaly"
  | "straight_lining";

export type ResponseQualityFlag = {
  count?: number;
  detail?: string;
  item_id?: string;
  reason: ResponseQualityFlagReason;
  response_time_seconds?: number | null;
  value?: number | string;
};

export type ScoringEngineMode = "PHASE_A_CLASSICAL" | "PHASE_B_HYBRID_IRT";

export type ScoringModelConfig = {
  cat: {
    enabled: boolean;
    exposure_penalty_pct: number;
    max_items: number;
    min_items: number;
    target_standard_error: number;
  };
  cognitive: {
    accuracy_weight_pct: number;
    default_time_limit_seconds: number;
    speed_floor_pct: number;
    speed_weight_pct: number;
  };
  development: {
    gap_percentile_threshold: number;
    high_stakes_gap_threshold: number;
  };
  execution: {
    scenario_weight_pct: number;
    self_report_weight_pct: number;
  };
  fit_thresholds: {
    develop_min: number;
    fit_min: number;
    strong_fit_min: number;
  };
  irt: {
    convergence_delta: number;
    max_iterations: number;
    theta_max: number;
    theta_min: number;
  };
  leadership: {
    peer_weight_pct: number;
    self_weight_pct: number;
    senior_role_keywords: string[];
  };
  norms: {
    default_norm_group_name: string;
    percentile_breakpoints: number[];
  };
  permissible_use: {
    leadership_requires_senior_role: boolean;
    motivation_allowed_for_hiring: boolean;
    personality_requires_phase_b_for_hiring: boolean;
  };
  quality: {
    disengagement_seconds: number;
    extreme_response_ratio: number;
    max_flags_before_invalidation: number;
    max_straight_line_count: number;
    speed_anomaly_seconds: number;
  };
  role_fit: {
    default_ideal_ranges: Partial<Record<AssessmentLayerCode, ScoreRange>>;
    role_family_ideal_ranges: Record<string, Partial<Record<AssessmentLayerCode, ScoreRange>>>;
  };
  transparent_explanations: boolean;
};

export type ScoringItemOption = {
  display_order: number;
  is_correct?: boolean;
  option_text: string;
  score_weight?: number;
  trait?: string;
};

export type ScoringItem = {
  difficulty_b: number | null;
  discrimination_a: number | null;
  guessing_c: number | null;
  id: string;
  item_type: ItemType;
  layer_code: AssessmentLayerCode;
  options: ScoringItemOption[];
  scoring_key: Record<string, unknown> | null;
  stem: string;
  sub_dimension_id: string | null;
  sub_dimension_name: string | null;
  time_limit_seconds: number | null;
};

export type ScoringResponse = {
  assessment_id: string;
  id: string;
  item: ScoringItem;
  response_time_seconds: number | null;
  response_value: unknown;
  sequence_number: number;
};

export type ConstructContribution = {
  layer_code: AssessmentLayerCode;
  raw_score: number;
  sub_dimension_id: string;
  sub_dimension_name: string;
};

export type ScoredItemResult = {
  construct_contributions: ConstructContribution[];
  explanation: Record<string, unknown>;
  item_id: string;
  layer_code: AssessmentLayerCode;
  quality_flags: ResponseQualityFlag[];
  raw_value: unknown;
  response_id: string;
  scored_value: number | null;
  speed_score: number | null;
  sub_dimension_id: string | null;
};

export type ConstructScore = {
  comparability: ScoreComparability;
  explanation: string;
  layer_code: AssessmentLayerCode;
  percentile: number | null;
  raw_score: number;
  reliability_alpha: number | null;
  sub_dimension_id: string;
  sub_dimension_name: string;
  z_score: number | null;
};

export type LayerScore = {
  explanation: string;
  included_in_role_fit: boolean;
  layer_code: AssessmentLayerCode;
  normalized_score_0_100: number;
  percentile: number | null;
  raw_score: number;
  z_score: number | null;
};

export type RoleFitDriver = {
  adjusted_score: number;
  gap_to_ideal: number;
  ideal_range: ScoreRange | null;
  label: string;
  layer_code: AssessmentLayerCode;
  weighted_contribution: number;
};

export type RoleFitComputation = {
  excluded_layers: AssessmentLayerCode[];
  fit_score_pct: number;
  included_layers: AssessmentLayerCode[];
  recommendation: RoleFitRecommendation;
  top_2_constraints: RoleFitDriver[];
  top_3_drivers: RoleFitDriver[];
};

export type DevelopmentGap = {
  high_stakes_gap: boolean;
  percentile: number | null;
  recommendation_texts: string[];
  score_0_100: number;
  sub_dimension_id: string;
  sub_dimension_name: string;
};
