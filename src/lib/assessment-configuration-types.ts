import type { AssessmentVersionStatus, ItemType } from "@prisma/client";

export type AssessmentConfigSnapshot = {
  anti_gaming_thresholds: {
    max_flags_before_invalidation: number;
    max_straight_line_count: number;
    speed_anomaly_seconds: number;
  };
  break_point_after_layer?: string | null;
  draft_preview_enabled?: boolean;
  dropout_threshold_pct: number;
  pause_resume_rules: {
    allow_pause: boolean;
    allow_resume: boolean;
  };
  per_item_timers_enabled: boolean;
  personality_hiring_allowed: boolean;
  proctor_mode_default: boolean;
  publish_notes?: string;
  question_randomisation: boolean;
  role_family_overrides?: Record<string, RoleFamilyAssessmentOverride>;
  section_randomisation: boolean;
  total_battery_time_cap_seconds: number;
};

export type SectionSnapshotEditor = {
  break_after?: boolean;
  enabled: boolean;
  item_count: number;
  item_type_filters: ItemType[];
  layer_code: string;
  order: number;
  pagination_style?: string;
  q_sort_distribution?: Record<string, number>;
  tag_filters?: Record<string, string>;
  time_limit_seconds?: number | null;
};

export type RoleFamilyAssessmentOverride = {
  break_point_after_layer?: string | null;
  section_overrides?: Record<
    string,
    Partial<{
      break_after: boolean;
      enabled: boolean;
      item_count: number;
      item_type_filters: ItemType[];
      order: number;
      pagination_style: string;
      q_sort_distribution: Record<string, number>;
      tag_filters: Record<string, string>;
      time_limit_seconds: number | null;
    }>
  >;
  total_battery_time_cap_seconds?: number | null;
};

export type AssessmentVersionDto = {
  assessment_count: number;
  created_at: string;
  id: string;
  published_at: string | null;
  role_family_override_count: number;
  scoring_config_snapshot: AssessmentConfigSnapshot;
  sections_snapshot: SectionSnapshotEditor[];
  status: AssessmentVersionStatus;
  updated_at: string;
  usage_campaign_count: number;
  version_label: string;
};
