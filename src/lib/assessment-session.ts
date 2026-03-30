export type AssessmentStage = "assessment" | "complete" | "consent" | "landing";

export type AssessmentPublicItemOption = {
  desirability_rating?: number;
  display_order?: number;
  id?: string;
  is_correct?: boolean;
  label?: string;
  option_text?: string;
  score_weight?: number;
  shape?: string;
  trait?: string;
};

export type AssessmentPublicItem = {
  id: string;
  item_type: string;
  options: AssessmentPublicItemOption[];
  scoring_key: Record<string, unknown> | null;
  stem: string;
  tags: Record<string, unknown> | null;
  time_limit_seconds: number | null;
};

export type AssessmentSessionResponse = {
  id: string;
  is_flagged: boolean;
  item_id: string;
  response_time_seconds: number | null;
  response_value: unknown;
  sequence_number: number;
};

export type AssessmentSessionSection = {
  id: string;
  item_ids_snapshot: string[];
  items: AssessmentPublicItem[];
  items_answered: number;
  items_presented: number;
  layer_code: string;
  layer_name: string;
  response_count: number;
  responses: AssessmentSessionResponse[];
  runtime_config_snapshot: Record<string, unknown> | null;
  section_order: number;
  started_at: string | null;
  status: string;
  time_limit_seconds: number | null;
};

export type AssessmentSession = {
  assessment: {
    completed_at: string | null;
    consent_given_at: string | null;
    created_at: string;
    id: string;
    quality_flags: Array<Record<string, unknown>>;
    runtime_metadata: Record<string, unknown>;
    sections: AssessmentSessionSection[];
    started_at: string | null;
    status: string;
    total_time_seconds: number | null;
  } | null;
  campaign: {
    deadline: string | null;
    id: string;
    invite_template: string;
    name: string;
    role_family: string;
    version_label: string;
  };
  candidate: {
    email: string;
    id: string | null;
    name: string;
  };
  invite: {
    email: string;
    expires_at: string | null;
    id: string;
    reminder_count: number;
    status: string;
    token: string;
  };
  organization: {
    consent_text: string;
    logo_url: string | null;
    name: string;
    settings: Record<string, unknown>;
  };
  stage: AssessmentStage;
};

export type SectionSnapshot = {
  break_after?: boolean;
  enabled: boolean;
  item_count: number;
  item_type_filters: string[];
  layer_code: string;
  order: number;
  pagination_style?: string;
  q_sort_distribution?: Record<string, number>;
  tag_filters?: Record<string, string>;
  time_limit_seconds?: number;
};
