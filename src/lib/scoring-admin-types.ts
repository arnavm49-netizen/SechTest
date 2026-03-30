import type {
  AssessmentLayerCode,
  AssessmentStatus,
  RoleFitRecommendation,
  ScoringModelStatus,
  ScoringRunStatus,
} from "@prisma/client";
import type { ScoringEngineMode, ScoringModelConfig } from "@/lib/scoring/types";

export type ScoringModelDto = {
  created_at: string;
  engine_mode: ScoringEngineMode;
  id: string;
  notes: string | null;
  published_at: string | null;
  run_count: number;
  status: ScoringModelStatus;
  updated_at: string;
  version_label: string;
  config: ScoringModelConfig;
  name: string;
};

export type NormGroupDto = {
  description: string;
  id: string;
  latest_computed_at: string | null;
  member_count: number;
  name: string;
  statistic_count: number;
};

export type AssessmentScoringSummary = {
  assessment_id: string;
  assessment_version_label: string;
  candidate_email: string;
  candidate_name: string;
  completed_at: string | null;
  latest_fit_score_pct: number | null;
  latest_recommendation: RoleFitRecommendation | null;
  latest_run_id: string | null;
  latest_run_model_label: string | null;
  latest_run_status: ScoringRunStatus | null;
  quality_flag_count: number;
  role_family_name: string;
  status: AssessmentStatus;
};

export type ScoringRunDto = {
  assessment_id: string;
  candidate_name: string;
  completed_at: string | null;
  fit_score_pct: number | null;
  id: string;
  invalid_reason: string | null;
  model_label: string;
  quality_gate_passed: boolean;
  recommendation: RoleFitRecommendation | null;
  role_family_name: string;
  started_at: string;
  status: ScoringRunStatus;
  step_outputs: Record<string, unknown> | null;
};

export type ReliabilitySnapshotDto = {
  alpha: number | null;
  layer_code: AssessmentLayerCode;
  respondent_count: number;
  sub_dimension_id: string;
  sub_dimension_name: string;
};

export type ScoringAdminSnapshot = {
  assessments: AssessmentScoringSummary[];
  models: ScoringModelDto[];
  norm_groups: NormGroupDto[];
  recent_runs: ScoringRunDto[];
  reliability: ReliabilitySnapshotDto[];
};
