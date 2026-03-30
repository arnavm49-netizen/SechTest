import { clamp } from "@/lib/scoring/math";
import type { ScoredItemResult, ScoringItemOption, ScoringModelConfig, ScoringResponse } from "@/lib/scoring/types";
import { as_array, as_number, as_record, as_string, round_number } from "@/lib/scoring/utils";

type TriadTraitContribution = {
  raw_score: number;
  sub_dimension_name: string;
};

export function score_classical_response(response: ScoringResponse, config: ScoringModelConfig): ScoredItemResult {
  switch (response.item.item_type) {
    case "MCQ":
    case "SINGLE_CHOICE_TIMED":
      return score_mcq_response(response, config);
    case "LIKERT":
      return score_likert_response(response);
    case "SCENARIO":
      return score_partial_credit_response(response);
    case "Q_SORT":
      return score_qsort_response(response);
    case "FORCED_CHOICE_TRIAD":
      return score_triad_response(response);
    case "FORCED_CHOICE_PAIR":
      return score_pair_response(response);
    default:
      return {
        construct_contributions: [],
        explanation: { model: "unsupported_item_type" },
        item_id: response.item.id,
        layer_code: response.item.layer_code,
        quality_flags: [],
        raw_value: response.response_value,
        response_id: response.id,
        scored_value: null,
        speed_score: null,
        sub_dimension_id: response.item.sub_dimension_id,
      };
  }
}

function score_mcq_response(response: ScoringResponse, config: ScoringModelConfig): ScoredItemResult {
  const scoring_key = response.item.scoring_key ?? {};
  const accuracy_weight_pct = as_number(scoring_key.accuracy_weight)
    ? Number(scoring_key.accuracy_weight) * 100
    : config.cognitive.accuracy_weight_pct;
  const speed_weight_pct = as_number(scoring_key.speed_weight)
    ? Number(scoring_key.speed_weight) * 100
    : config.cognitive.speed_weight_pct;
  const selected_option = resolve_selected_option(response.response_value, response.item.options);
  const configured_correct_option = as_string(scoring_key.correct_option);
  const correct_option = configured_correct_option ?? response.item.options.find((option) => option.is_correct)?.option_text ?? null;
  const is_correct = Boolean(selected_option && correct_option && selected_option.option_text === correct_option);
  const time_limit_seconds = response.item.time_limit_seconds ?? config.cognitive.default_time_limit_seconds;
  const speed_score = calculate_speed_score(response.response_time_seconds, time_limit_seconds, config.cognitive.speed_floor_pct / 100);
  const weighted_accuracy = (accuracy_weight_pct / 100) * (is_correct ? 100 : 0);
  const weighted_speed = (speed_weight_pct / 100) * speed_score * (is_correct ? 1 : 0);
  const scored_value = round_number(weighted_accuracy + weighted_speed, 2);

  return {
    construct_contributions:
      response.item.sub_dimension_id && response.item.sub_dimension_name
        ? [
            {
              layer_code: response.item.layer_code,
              raw_score: scored_value,
              sub_dimension_id: response.item.sub_dimension_id,
              sub_dimension_name: response.item.sub_dimension_name,
            },
          ]
        : [],
    explanation: {
      accuracy_pct: round_number(weighted_accuracy, 2),
      correct_option,
      is_correct,
      model: "accuracy_speed",
      selected_option: selected_option?.option_text ?? null,
      speed_component_pct: round_number(weighted_speed, 2),
      speed_score: round_number(speed_score, 4),
    },
    item_id: response.item.id,
    layer_code: response.item.layer_code,
    quality_flags: [],
    raw_value: response.response_value,
    response_id: response.id,
    scored_value,
    speed_score: round_number(speed_score * 100, 2),
    sub_dimension_id: response.item.sub_dimension_id,
  };
}

function score_likert_response(response: ScoringResponse): ScoredItemResult {
  const scoring_key = response.item.scoring_key ?? {};
  const reverse_scored = scoring_key.reverse_scored === true;
  const original_value = clamp(as_number(response.response_value) ?? 3, 1, 5);
  const adjusted_value = reverse_scored ? 6 - original_value : original_value;
  const scored_value = round_number(((adjusted_value - 1) / 4) * 100, 2);

  return {
    construct_contributions:
      response.item.sub_dimension_id && response.item.sub_dimension_name
        ? [
            {
              layer_code: response.item.layer_code,
              raw_score: scored_value,
              sub_dimension_id: response.item.sub_dimension_id,
              sub_dimension_name: response.item.sub_dimension_name,
            },
          ]
        : [],
    explanation: {
      adjusted_value,
      model: "likert_reverse_coded",
      original_value,
      reverse_scored,
    },
    item_id: response.item.id,
    layer_code: response.item.layer_code,
    quality_flags: [],
    raw_value: response.response_value,
    response_id: response.id,
    scored_value,
    speed_score: null,
    sub_dimension_id: response.item.sub_dimension_id,
  };
}

function score_partial_credit_response(response: ScoringResponse): ScoredItemResult {
  const selected_option = resolve_selected_option(response.response_value, response.item.options);
  const raw_points = clamp(selected_option?.score_weight ?? 0, 0, 4);
  const scored_value = round_number((raw_points / 4) * 100, 2);

  return {
    construct_contributions:
      response.item.sub_dimension_id && response.item.sub_dimension_name
        ? [
            {
              layer_code: response.item.layer_code,
              raw_score: scored_value,
              sub_dimension_id: response.item.sub_dimension_id,
              sub_dimension_name: response.item.sub_dimension_name,
            },
          ]
        : [],
    explanation: {
      awarded_points: raw_points,
      max_points: 4,
      model: "partial_credit_0_4",
      selected_option: selected_option?.option_text ?? null,
    },
    item_id: response.item.id,
    layer_code: response.item.layer_code,
    quality_flags: [],
    raw_value: response.response_value,
    response_id: response.id,
    scored_value,
    speed_score: null,
    sub_dimension_id: response.item.sub_dimension_id,
  };
}

function score_qsort_response(response: ScoringResponse): ScoredItemResult {
  const scoring_key = response.item.scoring_key ?? {};
  const distribution = as_array(scoring_key.distribution).map((entry) => as_string(entry)).filter((entry): entry is string => Boolean(entry));
  const buckets = distribution.length ? distribution : ["Most Important", "Important", "Somewhat Important", "Least Important"];
  const selected_bucket = as_string(response.response_value) ?? buckets[buckets.length - 1]!;
  const selected_index = Math.max(buckets.indexOf(selected_bucket), 0);
  const reversed_rank = buckets.length - selected_index;
  const scored_value = round_number(((reversed_rank - 1) / Math.max(buckets.length - 1, 1)) * 100, 2);

  return {
    construct_contributions:
      response.item.sub_dimension_id && response.item.sub_dimension_name
        ? [
            {
              layer_code: response.item.layer_code,
              raw_score: scored_value,
              sub_dimension_id: response.item.sub_dimension_id,
              sub_dimension_name: response.item.sub_dimension_name,
            },
          ]
        : [],
    explanation: {
      archetype_cluster_hint: as_string(scoring_key.archetype_cluster_hint),
      bucket_order: buckets,
      model: "relative_preference_qsort",
      selected_bucket,
    },
    item_id: response.item.id,
    layer_code: response.item.layer_code,
    quality_flags: [],
    raw_value: response.response_value,
    response_id: response.id,
    scored_value,
    speed_score: null,
    sub_dimension_id: response.item.sub_dimension_id,
  };
}

function score_triad_response(response: ScoringResponse): ScoredItemResult {
  const scoring_key = response.item.scoring_key ?? {};
  const value = as_record(response.response_value) ?? {};
  const most = as_string(value.most);
  const least = as_string(value.least);
  const statements = as_array(scoring_key.statements).map((entry) => as_record(entry)).filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const trait_lookup = new Map<string, string>();

  response.item.options.forEach((option, index) => {
    const trait = as_string(statements[index]?.trait) ?? option.trait ?? response.item.sub_dimension_name;
    if (trait) {
      trait_lookup.set(option.option_text, trait);
    }
  });

  const traits = new Set(Array.from(trait_lookup.values()).filter(Boolean));
  const contributions: TriadTraitContribution[] = Array.from(traits).map((trait) => ({
    raw_score: 50,
    sub_dimension_name: trait,
  }));

  if (most && trait_lookup.get(most)) {
    const trait = trait_lookup.get(most)!;
    contributions.find((entry) => entry.sub_dimension_name === trait)!.raw_score = 100;
  }

  if (least && trait_lookup.get(least)) {
    const trait = trait_lookup.get(least)!;
    contributions.find((entry) => entry.sub_dimension_name === trait)!.raw_score = 0;
  }

  return {
    construct_contributions: [],
    explanation: {
      least,
      model: "forced_choice_triad_rank",
      most,
      trait_contributions: contributions,
    },
    item_id: response.item.id,
    layer_code: response.item.layer_code,
    quality_flags: [],
    raw_value: response.response_value,
    response_id: response.id,
    scored_value: 50,
    speed_score: null,
    sub_dimension_id: response.item.sub_dimension_id,
  };
}

function score_pair_response(response: ScoringResponse): ScoredItemResult {
  const scoring_key = response.item.scoring_key ?? {};
  const mapping = as_record(scoring_key.option_scores) ?? as_record(scoring_key.pair_mapping) ?? {};
  const selected_option = resolve_selected_option(response.response_value, response.item.options);
  const mapped_score = selected_option ? as_number(mapping[selected_option.option_text]) : null;

  let scored_value = mapped_score;

  if (scored_value === null && selected_option) {
    const option_weights = response.item.options.map((option) => option.score_weight ?? 0);
    const max = Math.max(...option_weights, 1);
    const min = Math.min(...option_weights, 0);
    scored_value = ((selected_option.score_weight ?? 0) - min) / Math.max(max - min, 1) * 100;
  }

  const final_value = round_number(clamp(scored_value ?? 50, 0, 100), 2);

  return {
    construct_contributions:
      response.item.sub_dimension_id && response.item.sub_dimension_name
        ? [
            {
              layer_code: response.item.layer_code,
              raw_score: final_value,
              sub_dimension_id: response.item.sub_dimension_id,
              sub_dimension_name: response.item.sub_dimension_name,
            },
          ]
        : [],
    explanation: {
      mapped_score: final_value,
      model: "forced_choice_pair_mapping",
      selected_option: selected_option?.option_text ?? null,
    },
    item_id: response.item.id,
    layer_code: response.item.layer_code,
    quality_flags: [],
    raw_value: response.response_value,
    response_id: response.id,
    scored_value: final_value,
    speed_score: null,
    sub_dimension_id: response.item.sub_dimension_id,
  };
}

export function calculate_speed_score(response_time_seconds: number | null, time_limit_seconds: number, floor: number) {
  if (!response_time_seconds || response_time_seconds <= 0 || time_limit_seconds <= 0) {
    return 1;
  }

  const remaining_ratio = 1 - response_time_seconds / time_limit_seconds;
  return clamp(Math.max(remaining_ratio, floor), 0, 1);
}

function resolve_selected_option(value: unknown, options: ScoringItemOption[]) {
  if (typeof value === "string") {
    return options.find((option) => option.option_text === value) ?? null;
  }

  if (typeof value === "number") {
    return options.find((option, index) => option.score_weight === value || index + 1 === value) ?? null;
  }

  return null;
}
