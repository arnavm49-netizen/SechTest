import { ItemReviewStatus, ItemType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { QuestionBankItemDto, QuestionBankOption } from "@/lib/question-bank-types";

const option_schema = z.object({
  desirability_rating: z.number().min(1).max(5).optional(),
  display_order: z.number().int().positive().optional(),
  is_correct: z.boolean().optional(),
  option_text: z.string().min(1),
  rationale: z.string().optional(),
  score_weight: z.number().optional(),
  trait: z.string().optional(),
}) satisfies z.ZodType<QuestionBankOption>;

export const question_bank_item_schema = z.object({
  correct_answer: z.any().optional(),
  desirability_rating: z.number().min(1).max(5).nullable().optional(),
  difficulty_b: z.number().nullable().optional(),
  discrimination_a: z.number().nullable().optional(),
  guessing_c: z.number().nullable().optional(),
  is_active: z.boolean().default(true),
  item_type: z.nativeEnum(ItemType),
  layer_id: z.string().min(1),
  max_exposure_pct: z.number().positive().default(30),
  options: z.array(option_schema).default([]),
  review_status: z.nativeEnum(ItemReviewStatus).default("DRAFT"),
  scoring_key: z.any().optional(),
  stem: z.string().min(5),
  sub_dimension_id: z.string().min(1).nullable().optional(),
  tags: z.any().optional(),
  time_limit_seconds: z.number().int().positive().nullable().optional(),
});

export async function list_question_bank_items(input: {
  is_active?: string | null;
  item_type?: string | null;
  layer_code?: string | null;
  review_status?: string | null;
  role_family?: string | null;
  search?: string | null;
  sub_dimension_id?: string | null;
  tag?: string | null;
}) {
  const and_filters: Prisma.ItemWhereInput[] = [{ deleted_at: null }];

  if (input.search) {
    and_filters.push({
      OR: [
      { stem: { contains: input.search, mode: "insensitive" } },
      { tags: { path: ["role_family_usage"], array_contains: [input.search] } },
      ],
    });
  }

  if (input.layer_code) {
    and_filters.push({
      assessment_layer: {
        code: input.layer_code as never,
      },
    });
  }

  if (input.sub_dimension_id) {
    and_filters.push({ sub_dimension_id: input.sub_dimension_id });
  }

  if (input.item_type) {
    and_filters.push({ item_type: input.item_type as ItemType });
  }

  if (input.review_status) {
    and_filters.push({ review_status: input.review_status as ItemReviewStatus });
  }

  if (input.is_active === "true" || input.is_active === "false") {
    and_filters.push({ is_active: input.is_active === "true" });
  }

  if (input.tag) {
    and_filters.push({
      tags: {
        path: ["topic"],
        string_contains: input.tag,
      },
    });
  }

  if (input.role_family) {
    and_filters.push({
      tags: {
        path: ["role_family_usage"],
        array_contains: [input.role_family],
      },
    });
  }

  const items = await prisma.item.findMany({
    where: { AND: and_filters },
    orderBy: [{ updated_at: "desc" }],
    include: {
      assessment_layer: true,
      item_options: {
        where: { deleted_at: null },
        orderBy: { display_order: "asc" },
      },
      question_versions: {
        where: { deleted_at: null },
        orderBy: { version_number: "desc" },
      },
      sub_dimension: true,
    },
  });

  const total_assessments = await prisma.assessment.count({
    where: { deleted_at: null },
  });

  return items.map((item) => serialize_question_bank_item(item, total_assessments));
}

export async function create_question_bank_item(input: { actor_id: string; data: z.infer<typeof question_bank_item_schema> }) {
  validate_structured_item(input.data.item_type, input.data.options);

  const item = await prisma.item.create({
    data: {
      correct_answer: to_nullable_json_input(input.data.correct_answer),
      created_by: input.actor_id,
      desirability_rating: input.data.desirability_rating ?? null,
      difficulty_b: input.data.difficulty_b ?? null,
      discrimination_a: input.data.discrimination_a ?? null,
      guessing_c: input.data.guessing_c ?? null,
      is_active: input.data.is_active,
      item_type: input.data.item_type,
      layer_id: input.data.layer_id,
      max_exposure_pct: input.data.max_exposure_pct,
      options: input.data.options,
      review_status: input.data.review_status,
      scoring_key: to_nullable_json_input(input.data.scoring_key),
      stem: input.data.stem,
      sub_dimension_id: input.data.sub_dimension_id ?? null,
      tags: input.data.tags ?? {},
      time_limit_seconds: input.data.time_limit_seconds ?? null,
    },
  });

  await replace_item_options(item.id, input.data.options);
  await create_question_version({
    actor_id: input.actor_id,
    change_notes: "Initial version",
    item_id: item.id,
    options: input.data.options,
    scoring_key: input.data.scoring_key,
    stem: input.data.stem,
    version_number: 1,
  });

  return get_question_bank_item(item.id);
}

export async function update_question_bank_item(input: {
  actor_id: string;
  data: Partial<z.infer<typeof question_bank_item_schema>>;
  item_id: string;
}) {
  const existing = await prisma.item.findUnique({
    where: { id: input.item_id },
    include: {
      item_options: {
        where: { deleted_at: null },
        orderBy: { display_order: "asc" },
      },
      question_versions: {
        where: { deleted_at: null },
        orderBy: { version_number: "desc" },
      },
    },
  });

  if (!existing || existing.deleted_at) {
    throw new Error("Item not found.");
  }

  const merged_options = input.data.options ?? normalize_item_options(existing.options, existing.item_options);
  validate_structured_item(input.data.item_type ?? existing.item_type, merged_options);

  const next_version = (existing.question_versions[0]?.version_number ?? existing.version) + 1;
  const next_is_active =
    input.data.is_active ?? (existing.exposure_count >= (input.data.max_exposure_pct ?? existing.max_exposure_pct) ? false : existing.is_active);
  const next_review_status =
    existing.exposure_count >= (input.data.max_exposure_pct ?? existing.max_exposure_pct) ? "RETIRED" : input.data.review_status ?? existing.review_status;

  await prisma.item.update({
    where: { id: existing.id },
    data: {
      correct_answer:
        input.data.correct_answer === undefined ? to_nullable_json_input(existing.correct_answer) : to_nullable_json_input(input.data.correct_answer),
      desirability_rating: input.data.desirability_rating === undefined ? existing.desirability_rating : input.data.desirability_rating,
      difficulty_b: input.data.difficulty_b === undefined ? existing.difficulty_b : input.data.difficulty_b,
      discrimination_a: input.data.discrimination_a === undefined ? existing.discrimination_a : input.data.discrimination_a,
      guessing_c: input.data.guessing_c === undefined ? existing.guessing_c : input.data.guessing_c,
      is_active: next_is_active,
      item_type: input.data.item_type ?? existing.item_type,
      layer_id: input.data.layer_id ?? existing.layer_id,
      max_exposure_pct: input.data.max_exposure_pct ?? existing.max_exposure_pct,
      options: merged_options,
      review_status: next_review_status,
      scoring_key: input.data.scoring_key === undefined ? to_nullable_json_input(existing.scoring_key) : to_nullable_json_input(input.data.scoring_key),
      stem: input.data.stem ?? existing.stem,
      sub_dimension_id: input.data.sub_dimension_id === undefined ? existing.sub_dimension_id : input.data.sub_dimension_id,
      tags: input.data.tags === undefined ? existing.tags : input.data.tags,
      time_limit_seconds: input.data.time_limit_seconds === undefined ? existing.time_limit_seconds : input.data.time_limit_seconds,
      version: next_version,
    },
  });

  await replace_item_options(existing.id, merged_options);
  await create_question_version({
    actor_id: input.actor_id,
    change_notes: "Updated from Question Bank Manager",
    item_id: existing.id,
    options: merged_options,
    scoring_key: input.data.scoring_key === undefined ? existing.scoring_key : input.data.scoring_key,
    stem: input.data.stem ?? existing.stem,
    version_number: next_version,
  });

  return get_question_bank_item(existing.id);
}

export async function bulk_update_question_bank_status(input: { actor_id: string; item_ids: string[]; review_status: ItemReviewStatus }) {
  await prisma.item.updateMany({
    where: {
      id: { in: input.item_ids },
    },
    data: {
      is_active: input.review_status !== "RETIRED",
      review_status: input.review_status,
    },
  });

  const touched = await prisma.item.findMany({
    where: { id: { in: input.item_ids } },
  });

  for (const item of touched) {
    const version_number = item.version + 1;
    await prisma.item.update({
      where: { id: item.id },
      data: {
        version: version_number,
      },
    });

    await create_question_version({
      actor_id: input.actor_id,
      change_notes: `Bulk status change to ${input.review_status}`,
      item_id: item.id,
      options: normalize_item_options(item.options, []),
      scoring_key: item.scoring_key,
      stem: item.stem,
      version_number,
    });
  }
}

export async function get_question_bank_item(item_id: string) {
  const item = await prisma.item.findUnique({
    where: { id: item_id },
    include: {
      assessment_layer: true,
      item_options: {
        where: { deleted_at: null },
        orderBy: { display_order: "asc" },
      },
      question_versions: {
        where: { deleted_at: null },
        orderBy: { version_number: "desc" },
      },
      sub_dimension: true,
    },
  });

  if (!item || item.deleted_at) {
    throw new Error("Item not found.");
  }

  const total_assessments = await prisma.assessment.count({
    where: { deleted_at: null },
  });

  return serialize_question_bank_item(item, total_assessments);
}

export function normalize_item_options(
  raw_options: unknown,
  fallback_item_options: Array<{ option_text: string; score_weight: number; display_order?: number; is_correct?: boolean }>,
): QuestionBankOption[] {
  if (Array.isArray(raw_options)) {
    return raw_options.map(normalize_question_bank_option).filter((option): option is QuestionBankOption => Boolean(option));
  }

  if (
    raw_options &&
    typeof raw_options === "object" &&
    "editor_options" in raw_options &&
    Array.isArray((raw_options as Record<string, unknown>).editor_options)
  ) {
    return ((raw_options as Record<string, unknown>).editor_options as unknown[])
      .map(normalize_question_bank_option)
      .filter((option): option is QuestionBankOption => Boolean(option));
  }

  return fallback_item_options.map((option, index) => ({
    display_order: index + 1,
    is_correct: option.is_correct,
    option_text: option.option_text,
    score_weight: option.score_weight,
  }));
}

function serialize_question_bank_item(item: {
  assessment_layer: { code: string; name: string };
  correct_answer: Prisma.JsonValue;
  desirability_rating: number | null;
  difficulty_b: number | null;
  discrimination_a: number | null;
  exposure_count: number;
  guessing_c: number | null;
  id: string;
  is_active: boolean;
  item_options: Array<{ display_order: number; is_correct: boolean; option_text: string; score_weight: number }>;
  item_type: ItemType;
  last_used_at: Date | null;
  max_exposure_pct: number;
  options: unknown;
  question_versions: Array<{
    change_notes: string | null;
    changed_at: Date;
    id: string;
    options_snapshot: Prisma.JsonValue;
    scoring_key_snapshot: Prisma.JsonValue;
    stem_snapshot: string;
    version_number: number;
  }>;
  review_status: ItemReviewStatus;
  scoring_key: Prisma.JsonValue;
  stem: string;
  sub_dimension: { id: string; name: string } | null;
  tags: Prisma.JsonValue;
  time_limit_seconds: number | null;
  updated_at: Date;
  version: number;
}, total_assessments: number): QuestionBankItemDto {
  const options = normalize_item_options(item.options, item.item_options);
  const exposure_pct = total_assessments > 0 ? Number(((item.exposure_count / total_assessments) * 100).toFixed(1)) : 0;

  return {
    correct_answer: item.correct_answer ?? null,
    desirability_rating: item.desirability_rating,
    difficulty_b: item.difficulty_b,
    discrimination_a: item.discrimination_a,
    exposure_count: item.exposure_count,
    exposure_pct,
    guessing_c: item.guessing_c,
    id: item.id,
    is_active: item.is_active,
    item_type: item.item_type,
    last_used_at: item.last_used_at?.toISOString() ?? null,
    layer_code: item.assessment_layer.code,
    layer_name: item.assessment_layer.name,
    max_exposure_pct: item.max_exposure_pct,
    options,
    review_status: item.review_status,
    scoring_key: item.scoring_key,
    stem: item.stem,
    sub_dimension_id: item.sub_dimension?.id ?? null,
    sub_dimension_name: item.sub_dimension?.name ?? null,
    tags: item.tags,
    time_limit_seconds: item.time_limit_seconds,
    updated_at: item.updated_at.toISOString(),
    version: item.version,
    version_history: item.question_versions.map((version) => ({
      change_notes: version.change_notes,
      changed_at: version.changed_at.toISOString(),
      id: version.id,
      options_snapshot: version.options_snapshot,
      scoring_key_snapshot: version.scoring_key_snapshot,
      stem_snapshot: version.stem_snapshot,
      version_number: version.version_number,
    })),
  };
}

function validate_structured_item(item_type: ItemType, options: z.infer<typeof option_schema>[]) {
  if (["MCQ", "SCENARIO", "FORCED_CHOICE_TRIAD"].includes(item_type) && options.length < 2) {
    throw new Error("This item type requires at least two options.");
  }

  if (item_type === "FORCED_CHOICE_TRIAD") {
    if (options.length !== 3) {
      throw new Error("Forced-choice triads must contain exactly three statements.");
    }

    const desirability_scores = options.map((option) => option.desirability_rating ?? 4);
    const max = Math.max(...desirability_scores);
    const min = Math.min(...desirability_scores);

    if (max - min > 1) {
      throw new Error("Triad desirability ratings must remain within 1 point of each other.");
    }
  }
}

async function replace_item_options(item_id: string, options: z.infer<typeof option_schema>[]) {
  await prisma.itemOption.deleteMany({
    where: { item_id },
  });

  if (!options.length) {
    return;
  }

  await prisma.itemOption.createMany({
    data: options.map((option, index) => ({
      display_order: option.display_order ?? index + 1,
      is_correct: option.is_correct ?? false,
      item_id,
      option_text: option.option_text,
      score_weight: option.score_weight ?? 0,
    })),
  });
}

async function create_question_version(input: {
  actor_id: string;
  change_notes: string;
  item_id: string;
  options: unknown;
  scoring_key: unknown;
  stem: string;
  version_number: number;
}) {
  await prisma.questionVersion.create({
    data: {
      change_notes: input.change_notes,
      changed_by: input.actor_id,
      item_id: input.item_id,
      options_snapshot: to_nullable_json_input(input.options),
      scoring_key_snapshot: to_nullable_json_input(input.scoring_key),
      stem_snapshot: input.stem,
      version_number: input.version_number,
    },
  });
}

function normalize_question_bank_option(value: unknown): QuestionBankOption | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const option = value as Record<string, unknown>;

  if (typeof option.option_text !== "string" || !option.option_text.trim()) {
    return null;
  }

  return {
    desirability_rating: typeof option.desirability_rating === "number" ? option.desirability_rating : undefined,
    display_order: typeof option.display_order === "number" ? option.display_order : undefined,
    is_correct: typeof option.is_correct === "boolean" ? option.is_correct : undefined,
    option_text: option.option_text,
    rationale: typeof option.rationale === "string" ? option.rationale : undefined,
    score_weight: typeof option.score_weight === "number" ? option.score_weight : undefined,
    trait: typeof option.trait === "string" ? option.trait : undefined,
  };
}

function to_nullable_json_input(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
