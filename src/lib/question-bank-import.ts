import Papa from "papaparse";
import { ItemReviewStatus, ItemType } from "@prisma/client";
import type { QuestionBankOption } from "@/lib/question-bank-types";

type ImportedQuestionBankRow = {
  correct_answer?: unknown;
  desirability_rating?: number | null;
  difficulty_b?: number | null;
  discrimination_a?: number | null;
  guessing_c?: number | null;
  is_active: boolean;
  item_type: ItemType;
  layer_code: string;
  max_exposure_pct: number;
  options: QuestionBankOption[];
  review_status: ItemReviewStatus;
  scoring_key?: unknown;
  stem: string;
  sub_dimension_code?: string | null;
  tags?: unknown;
  time_limit_seconds?: number | null;
};

export function parse_question_bank_import(input: { content: string; format: "csv" | "json" }) {
  return input.format === "json" ? parse_json_import(input.content) : parse_csv_import(input.content);
}

function parse_json_import(content: string) {
  try {
    const parsed = JSON.parse(content) as ImportedQuestionBankRow[];

    if (!Array.isArray(parsed)) {
      return {
        errors: [{ line_number: 1, message: "JSON import must be an array of item objects." }],
        rows: [] as Array<{ data: ImportedQuestionBankRow; line_number: number }>,
      };
    }

    return {
      errors: [] as Array<{ line_number: number; message: string }>,
      rows: parsed.map((entry, index) => ({
        data: normalize_import_row(entry),
        line_number: index + 1,
      })),
    };
  } catch {
    return {
      errors: [{ line_number: 1, message: "JSON could not be parsed." }],
      rows: [] as Array<{ data: ImportedQuestionBankRow; line_number: number }>,
    };
  }
}

function parse_csv_import(content: string) {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const rows: Array<{ data: ImportedQuestionBankRow; line_number: number }> = [];
  const errors: Array<{ line_number: number; message: string }> = [];

  for (const [index, row] of parsed.data.entries()) {
    const line_number = index + 2;

    try {
      rows.push({
        data: normalize_import_row({
          correct_answer: parse_json_field(row.correct_answer),
          desirability_rating: row.desirability_rating ? Number(row.desirability_rating) : null,
          difficulty_b: row.difficulty_b ? Number(row.difficulty_b) : null,
          discrimination_a: row.discrimination_a ? Number(row.discrimination_a) : null,
          guessing_c: row.guessing_c ? Number(row.guessing_c) : null,
          is_active: row.is_active ? row.is_active !== "false" : true,
          item_type: row.item_type as ItemType,
          layer_code: row.layer_code,
          max_exposure_pct: row.max_exposure_pct ? Number(row.max_exposure_pct) : 30,
          options: parse_json_field(row.options) ?? [],
          review_status: (row.review_status as ItemReviewStatus) || "DRAFT",
          scoring_key: parse_json_field(row.scoring_key),
          stem: row.stem,
          sub_dimension_code: row.sub_dimension_code,
          tags: parse_json_field(row.tags),
          time_limit_seconds: row.time_limit_seconds ? Number(row.time_limit_seconds) : null,
        }),
        line_number,
      });
    } catch {
      errors.push({
        line_number,
        message: "One or more JSON columns could not be parsed.",
      });
    }
  }

  return { errors, rows };
}

function normalize_import_row(row: Partial<ImportedQuestionBankRow>) {
  return {
    correct_answer: row.correct_answer ?? null,
    desirability_rating: row.desirability_rating ?? null,
    difficulty_b: row.difficulty_b ?? null,
    discrimination_a: row.discrimination_a ?? null,
    guessing_c: row.guessing_c ?? null,
    is_active: row.is_active ?? true,
    item_type: row.item_type ?? "MCQ",
    layer_code: row.layer_code ?? "",
    max_exposure_pct: row.max_exposure_pct ?? 30,
    options: Array.isArray(row.options) ? row.options.filter(is_question_bank_option) : [],
    review_status: row.review_status ?? "DRAFT",
    scoring_key: row.scoring_key ?? null,
    stem: row.stem ?? "",
    sub_dimension_code: row.sub_dimension_code ?? null,
    tags: row.tags ?? {},
    time_limit_seconds: row.time_limit_seconds ?? null,
  };
}

function parse_json_field(value?: string) {
  if (!value) {
    return null;
  }

  return JSON.parse(value);
}

function is_question_bank_option(value: unknown): value is QuestionBankOption {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "option_text" in value &&
      typeof (value as { option_text?: unknown }).option_text === "string",
  );
}
