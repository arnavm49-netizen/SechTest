import { z } from "zod";
import type { AssessmentLayerCode } from "@prisma/client";
import type { ScoreRange, ScoringEngineMode, ScoringModelConfig } from "@/lib/scoring/types";

const score_range_schema = z.object({
  max: z.number().min(0).max(100),
  min: z.number().min(0).max(100),
});

export const scoring_model_config_schema: z.ZodType<ScoringModelConfig> = z.object({
  cat: z.object({
    enabled: z.boolean(),
    exposure_penalty_pct: z.number().min(0).max(100),
    max_items: z.number().int().min(1),
    min_items: z.number().int().min(1),
    target_standard_error: z.number().positive(),
  }),
  cognitive: z.object({
    accuracy_weight_pct: z.number().min(0).max(100),
    default_time_limit_seconds: z.number().int().positive(),
    speed_floor_pct: z.number().min(0).max(100),
    speed_weight_pct: z.number().min(0).max(100),
  }),
  development: z.object({
    gap_percentile_threshold: z.number().min(0).max(100),
    high_stakes_gap_threshold: z.number().min(0).max(100),
  }),
  execution: z.object({
    scenario_weight_pct: z.number().min(0).max(100),
    self_report_weight_pct: z.number().min(0).max(100),
  }),
  fit_thresholds: z.object({
    develop_min: z.number().min(0).max(100),
    fit_min: z.number().min(0).max(100),
    strong_fit_min: z.number().min(0).max(100),
  }),
  irt: z.object({
    convergence_delta: z.number().positive(),
    max_iterations: z.number().int().positive(),
    theta_max: z.number().positive(),
    theta_min: z.number().negative(),
  }),
  leadership: z.object({
    peer_weight_pct: z.number().min(0).max(100),
    self_weight_pct: z.number().min(0).max(100),
    senior_role_keywords: z.array(z.string().min(1)),
  }),
  norms: z.object({
    default_norm_group_name: z.string().min(1),
    percentile_breakpoints: z.array(z.number().min(0).max(100)),
  }),
  permissible_use: z.object({
    leadership_requires_senior_role: z.boolean(),
    motivation_allowed_for_hiring: z.boolean(),
    personality_requires_phase_b_for_hiring: z.boolean(),
  }),
  quality: z.object({
    disengagement_seconds: z.number().positive(),
    extreme_response_ratio: z.number().min(0).max(1),
    max_flags_before_invalidation: z.number().int().positive(),
    max_straight_line_count: z.number().int().positive(),
    speed_anomaly_seconds: z.number().positive(),
  }),
  role_fit: z.object({
    default_ideal_ranges: z.record(z.string(), score_range_schema),
    role_family_ideal_ranges: z.record(z.string(), z.record(z.string(), score_range_schema)),
  }),
  transparent_explanations: z.boolean(),
});

export function default_scoring_model_config(engine_mode: ScoringEngineMode): ScoringModelConfig {
  const base: ScoringModelConfig = {
    cat: {
      enabled: true,
      exposure_penalty_pct: 20,
      max_items: 18,
      min_items: 8,
      target_standard_error: 0.32,
    },
    cognitive: {
      accuracy_weight_pct: 70,
      default_time_limit_seconds: 60,
      speed_floor_pct: 10,
      speed_weight_pct: 30,
    },
    development: {
      gap_percentile_threshold: 40,
      high_stakes_gap_threshold: 20,
    },
    execution: {
      scenario_weight_pct: 60,
      self_report_weight_pct: 40,
    },
    fit_thresholds: {
      develop_min: 45,
      fit_min: 65,
      strong_fit_min: 80,
    },
    irt: {
      convergence_delta: 0.001,
      max_iterations: 25,
      theta_max: 4,
      theta_min: -4,
    },
    leadership: {
      peer_weight_pct: 50,
      self_weight_pct: 50,
      senior_role_keywords: ["Manager", "Leader", "Head", "Director"],
    },
    norms: {
      default_norm_group_name: "Initial All-Org Norm",
      percentile_breakpoints: [5, 10, 25, 50, 75, 90, 95],
    },
    permissible_use: {
      leadership_requires_senior_role: true,
      motivation_allowed_for_hiring: false,
      personality_requires_phase_b_for_hiring: true,
    },
    quality: {
      disengagement_seconds: 6,
      extreme_response_ratio: 0.7,
      max_flags_before_invalidation: 3,
      max_straight_line_count: 5,
      speed_anomaly_seconds: 3,
    },
    role_fit: {
      default_ideal_ranges: {
        COGNITIVE: { max: 100, min: 55 },
        EXECUTION: { max: 100, min: 60 },
        LEADERSHIP: { max: 100, min: 50 },
        PERSONALITY: { max: 100, min: 45 },
        SJT: { max: 100, min: 60 },
      },
      role_family_ideal_ranges: {},
    },
    transparent_explanations: true,
  };

  if (engine_mode === "PHASE_B_HYBRID_IRT") {
    base.permissible_use.personality_requires_phase_b_for_hiring = true;
    base.cat.enabled = true;
  } else {
    base.cat.enabled = false;
  }

  return base;
}

export function normalize_scoring_model_config(config: unknown, engine_mode: ScoringEngineMode): ScoringModelConfig {
  const base = default_scoring_model_config(engine_mode);
  const record = as_record(config);
  const role_fit = as_record(record?.role_fit);

  return scoring_model_config_schema.parse({
    ...base,
    ...record,
    cat: {
      ...base.cat,
      ...as_record(record?.cat),
    },
    cognitive: {
      ...base.cognitive,
      ...as_record(record?.cognitive),
    },
    development: {
      ...base.development,
      ...as_record(record?.development),
    },
    execution: {
      ...base.execution,
      ...as_record(record?.execution),
    },
    fit_thresholds: {
      ...base.fit_thresholds,
      ...as_record(record?.fit_thresholds),
    },
    irt: {
      ...base.irt,
      ...as_record(record?.irt),
    },
    leadership: {
      ...base.leadership,
      ...as_record(record?.leadership),
    },
    norms: {
      ...base.norms,
      ...as_record(record?.norms),
    },
    permissible_use: {
      ...base.permissible_use,
      ...as_record(record?.permissible_use),
    },
    quality: {
      ...base.quality,
      ...as_record(record?.quality),
    },
    role_fit: {
      default_ideal_ranges: normalize_range_record(
        as_record(role_fit?.default_ideal_ranges),
        base.role_fit.default_ideal_ranges,
      ),
      role_family_ideal_ranges: normalize_role_family_ranges(
        as_record(role_fit?.role_family_ideal_ranges),
        base.role_fit.role_family_ideal_ranges,
      ),
    },
  });
}

export function resolve_ideal_ranges(
  config: ScoringModelConfig,
  role_family_name: string,
): Partial<Record<AssessmentLayerCode, ScoreRange>> {
  const merged: Partial<Record<AssessmentLayerCode, ScoreRange>> = {
    ...(config.role_fit.default_ideal_ranges as Partial<Record<AssessmentLayerCode, ScoreRange>>),
  };
  const override = config.role_fit.role_family_ideal_ranges[role_family_name] ?? {};

  for (const [layer_code, range] of Object.entries(override)) {
    merged[layer_code as AssessmentLayerCode] = range;
  }

  return merged;
}

function as_record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalize_range_record(
  value: Record<string, unknown> | null,
  fallback: Partial<Record<AssessmentLayerCode, ScoreRange>>,
): Partial<Record<AssessmentLayerCode, ScoreRange>> {
  const normalized = { ...fallback };

  for (const [layer_code, range] of Object.entries(value ?? {})) {
    const parsed = score_range_schema.safeParse(range);

    if (parsed.success) {
      normalized[layer_code as AssessmentLayerCode] = parsed.data;
    }
  }

  return normalized;
}

function normalize_role_family_ranges(
  value: Record<string, unknown> | null,
  fallback: Record<string, Partial<Record<AssessmentLayerCode, ScoreRange>>>,
): Record<string, Partial<Record<AssessmentLayerCode, ScoreRange>>> {
  const normalized = { ...fallback };

  for (const [role_family_name, range_record] of Object.entries(value ?? {})) {
    normalized[role_family_name] = normalize_range_record(as_record(range_record), normalized[role_family_name] ?? {});
  }

  return normalized;
}
