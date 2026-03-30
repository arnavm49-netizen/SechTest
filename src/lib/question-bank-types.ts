import type { ItemReviewStatus, ItemType } from "@prisma/client";

export type QuestionBankOption = {
  desirability_rating?: number;
  display_order?: number;
  is_correct?: boolean;
  option_text: string;
  rationale?: string;
  score_weight?: number;
  trait?: string;
};

export type QuestionBankVersionHistoryEntry = {
  change_notes: string | null;
  changed_at: string;
  id: string;
  options_snapshot: unknown;
  scoring_key_snapshot: unknown;
  stem_snapshot: string;
  version_number: number;
};

export type QuestionBankItemDto = {
  correct_answer?: unknown;
  desirability_rating?: number | null;
  difficulty_b?: number | null;
  discrimination_a?: number | null;
  exposure_count: number;
  exposure_pct: number;
  guessing_c?: number | null;
  id: string;
  is_active: boolean;
  item_type: ItemType;
  last_used_at: string | null;
  layer_code: string;
  layer_name: string;
  max_exposure_pct: number;
  options: QuestionBankOption[];
  review_status: ItemReviewStatus;
  scoring_key?: unknown;
  stem: string;
  sub_dimension_id: string | null;
  sub_dimension_name: string | null;
  tags?: unknown;
  time_limit_seconds?: number | null;
  updated_at: string;
  version: number;
  version_history: QuestionBankVersionHistoryEntry[];
};
