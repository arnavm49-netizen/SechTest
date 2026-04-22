export type RadarMetric = {
  label: string;
  score_0_100: number;
};

export type HeatmapGridScore = {
  score: number | null;
  sub_dimension_name: string;
  tone: string;
};

export type HeatmapGridRow = {
  candidate_name: string;
  recommendation: string | null;
  role_family_name: string;
  scores: HeatmapGridScore[];
};

export type CandidateAssessmentSummary = {
  id: string;
  role_family_name: string;
  status: string;
};

export type GovernanceRequestSummary = {
  id: string;
  request_note: string;
  request_type: string;
  status: string;
};

export type ComplianceSettings = {
  candidate_feedback_enabled: boolean;
  challenge_process_enabled: boolean;
  data_fiduciary_registration_required: boolean;
  retention_raw_responses_months: number;
  retention_scores_years: number;
  self_service_access_enabled: boolean;
};

export type ComplianceSnapshot = {
  adverse_action_notices: Array<{
    assessment_id: string;
    candidate_name: string;
    recommendation: string | null;
    status: string;
  }>;
  audit_logs: Array<{
    action: string;
    ip_address: string | null;
    target_entity: string;
    timestamp: string;
    user_name: string;
  }>;
  consent_record_count: number;
  consent_template: string;
  requests: Array<{
    assessment_id: string | null;
    created_at: string;
    request_id: string;
    request_note: string;
    request_type: string;
    resolution_note: string | null;
    reviewer_name: string | null;
    status: string;
    user_name: string;
  }>;
  settings: ComplianceSettings;
};

export type DevelopmentSnapshot = {
  recommendations: Array<{
    id: string;
    recommendation_text: string;
    reassessment_trigger: string;
    score_range_max: number;
    score_range_min: number;
    sub_dimension_name: string;
    timeline: string;
  }>;
  sub_dimensions: Array<{
    id: string;
    label: string;
  }>;
};

export type KpiDefinitionSummary = {
  data_source: string;
  id: string;
  kpi_description: string;
  kpi_name: string;
  measurement_frequency: string;
  measurement_unit: string;
  observation_count: number;
  prediction_horizon_months: number;
  recent_observations: Array<{
    observation_date: string;
    value: number;
  }>;
  role_family_id: string;
  role_family_name: string;
};

export type KpiCorrelationSummary = {
  adjusted_correlation: number | null;
  layer_code: string;
  naive_correlation: number | null;
  spearman_correlation: number | null;
  within_manager_correlation: number | null;
};

export type KpiSnapshot = {
  board_summary: {
    direct_line_of_sight_roles: string[];
    headline: string;
    sensitivities: Array<{
      estimated_ebitda_lift_pct: number | null;
      sample_n: number;
      small_n_warning: boolean;
      trait_name: string;
    }>;
  };
  correlations: Array<{
    kpi_name: string;
    role_family_name: string;
    sample_n: number;
    small_n_warning: boolean;
    summaries: KpiCorrelationSummary[];
  }>;
  definitions: KpiDefinitionSummary[];
  horizon_summary: Array<{
    checkpoints: Array<{
      checkpoint_month: number;
      observation_count: number;
    }>;
    layer_code: string;
  }>;
  recent_observations: Array<{
    kpi_name: string;
    manager_name: string | null;
    manager_quality_score: number | null;
    observation_date: string;
    role_family_name: string;
    user_name: string;
    value: number;
  }>;
};

export type SimpleDirectoryEntry = {
  id: string;
  name: string;
};

export type MultiRaterSnapshot = {
  assessments: Array<{
    assessment_id: string;
    candidate_name: string;
    role_family_name: string;
    subject_id: string;
  }>;
  assignments: Array<{
    assessment_id: string;
    assignment_id: string;
    calibration_completed: boolean;
    completed_response_count: number;
    relationship: string;
    rater_name: string;
    role_family_name: string;
    status: string;
    subject_name: string;
  }>;
  icc_summary: Array<{
    icc: number | null;
    relationship: string;
    sample_n: number;
    status: string;
    subject_id: string;
    subject_name: string;
  }>;
  rater_items: Array<{
    id: string;
    stem: string;
    sub_dimension_name: string;
  }>;
  raters: Array<SimpleDirectoryEntry & { role: string }>;
  settings: {
    blind_spot_flag_threshold: number;
    icc_threshold: number;
    max_ratees_per_rater: number;
    max_raters_per_subject: number;
    min_raters_per_subject: number;
  };
  subjects: Array<SimpleDirectoryEntry & { role: string }>;
};

export type RaterWorkspaceSnapshot = {
  assignments: Array<{
    assessment_id: string;
    assignment_id: string;
    calibration_completed: boolean;
    estimated_time_minutes: number;
    response_count: number;
    role_family_name: string;
    status: string;
    subject_name: string;
  }>;
  rater_items: Array<{
    id: string;
    stem: string;
    sub_dimension_name: string;
  }>;
};

export type ReportTemplateSummary = {
  branding: Record<string, unknown>;
  distribution_rules: Record<string, unknown>;
  id: string;
  is_active: boolean;
  name: string;
  report_type: string;
  sections_config: unknown;
};

export type ReportsSnapshot = {
  managers: SimpleDirectoryEntry[];
  recent_assessments: Array<{
    assessment_id: string;
    candidate_name: string;
    completed_at: string | null;
    latest_fit_score_pct: number | null;
    latest_recommendation: string | null;
    latest_run_model_label: string | null;
    manager_name: string | null;
    role_family_name: string;
    templates_generated: Array<{
      generated_at: string;
      report_type: string;
      template_name: string;
    }>;
  }>;
  templates: ReportTemplateSummary[];
};

export type IndividualReportView = {
  assessment: {
    assessment_id: string;
    candidate_name: string;
    role_family_name: string;
  };
  behaviour_maps: Array<{
    behaviour_description: string;
    outcome_description: string;
    sub_dimension_name: string;
  }>;
  blind_spot_gaps: Array<{
    blind_spot_flag: boolean;
    peer_average_100: number | null;
    self_score_100: number;
    sub_dimension_name: string;
  }>;
  development_plan: Array<{
    high_stakes_gap: boolean;
    recommendation_texts: string[];
    score_0_100: number | null;
    sub_dimension_name: string;
  }>;
  fit: {
    fit_score_pct: number | null;
    nine_box: string | null;
    performance_pct: number | null;
    potential_pct: number | null;
    recommendation: string | null;
    top_constraints: Array<{
      gap_to_ideal: number | null;
      label: string;
    }>;
    top_drivers: Array<{
      label: string;
      weighted_contribution: number | null;
    }>;
  };
  layer_scores: RadarMetric[];
  motivation_archetype: Array<{
    archetype: string;
    score_0_100: number;
  }>;
  personality_vector: Array<{
    score_0_10: number;
    sub_dimension_name: string;
  }>;
  report_model: string | null;
};

export type CandidateFeedbackView = {
  development_areas: Array<{
    sub_dimension_name: string;
  }>;
  feedback_indicator: string;
  strengths: Array<{
    label: string;
  }>;
};

export type TeamHeatmapView = {
  rows: HeatmapGridRow[];
  sub_dimensions: string[];
  summary: {
    assessment_count: number;
    high_risk_cells: number;
    strong_fit_count: number;
  };
};

export type SystemHealthSnapshot = {
  checks: Array<{
    check_code: string;
    checked_at: string;
    detail: string;
    next_review_at: string | null;
    severity: string;
    status: string;
    title: string;
    trigger_summary: string | null;
  }>;
};

export type ValiditySnapshot = {
  alerts: Array<{
    computed_at: string;
    layer_name: string;
    metric_name: string;
    notes: string | null;
    role_family_name: string;
    sample_n: number;
    validity_type: string;
  }>;
  evidence: Array<{
    computed_at: string;
    layer_code: string;
    layer_name: string;
    metric_name: string;
    metric_value: number;
    notes: string | null;
    pass_fail: boolean;
    preliminary: boolean;
    role_family_name: string;
    sample_n: number;
    status: string;
    sub_dimension_name: string | null;
    threshold: number;
    validity_type: string;
  }>;
  layers: Array<{
    code: string;
    name: string;
  }>;
  role_families: Array<{
    id: string;
    name: string;
  }>;
};
