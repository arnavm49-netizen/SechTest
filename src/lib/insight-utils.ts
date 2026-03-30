import { mean, standard_deviation } from "@/lib/scoring/math";
import { round_number } from "@/lib/scoring/utils";

export function clamp_number(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function pearson_correlation(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 2) {
    return null;
  }

  const left_mean = mean(left);
  const right_mean = mean(right);
  let numerator = 0;
  let left_denominator = 0;
  let right_denominator = 0;

  for (let index = 0; index < left.length; index += 1) {
    const left_delta = left[index]! - left_mean;
    const right_delta = right[index]! - right_mean;
    numerator += left_delta * right_delta;
    left_denominator += left_delta ** 2;
    right_denominator += right_delta ** 2;
  }

  const denominator = Math.sqrt(left_denominator * right_denominator);

  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return round_number(numerator / denominator, 4);
}

export function spearman_correlation(left: number[], right: number[]) {
  return pearson_correlation(rank_values(left), rank_values(right));
}

export function compute_linear_delta_r_squared(input: {
  baseline_scores: number[];
  comparison_scores: number[];
  outcomes: number[];
}) {
  const baseline_correlation = pearson_correlation(input.baseline_scores, input.outcomes);
  const comparison_correlation = pearson_correlation(input.comparison_scores, input.outcomes);

  if (baseline_correlation === null || comparison_correlation === null) {
    return null;
  }

  const baseline_r2 = baseline_correlation ** 2;
  const comparison_r2 = comparison_correlation ** 2;

  return round_number(comparison_r2 - baseline_r2, 4);
}

export function compute_selection_rate_ratio(groups: Array<{ group: string; selected: number; total: number }>) {
  const eligible_groups = groups.filter((group) => group.total > 0);

  if (!eligible_groups.length) {
    return [];
  }

  const rates = eligible_groups.map((group) => ({
    ...group,
    selection_rate: group.selected / group.total,
  }));
  const reference_rate = Math.max(...rates.map((group) => group.selection_rate), 0);

  return rates.map((group) => ({
    group: group.group,
    selected: group.selected,
    selection_rate: round_number(group.selection_rate, 4),
    total: group.total,
    ratio_to_reference: reference_rate > 0 ? round_number(group.selection_rate / reference_rate, 4) : null,
  }));
}

export function compute_icc(matrix: number[][]) {
  const sanitized = matrix.filter((row) => row.length > 1 && row.every((value) => Number.isFinite(value)));

  if (sanitized.length < 2) {
    return null;
  }

  const subject_count = sanitized.length;
  const rater_count = sanitized[0]!.length;
  const row_means = sanitized.map((row) => mean(row));
  const grand_mean = mean(row_means);
  const ms_between =
    row_means.reduce((sum, row_mean) => sum + rater_count * (row_mean - grand_mean) ** 2, 0) / Math.max(subject_count - 1, 1);
  const ms_within =
    sanitized.reduce((sum, row, row_index) => {
      const row_mean = row_means[row_index]!;
      return sum + row.reduce((row_sum, value) => row_sum + (value - row_mean) ** 2, 0);
    }, 0) / Math.max(subject_count * (rater_count - 1), 1);

  if (!Number.isFinite(ms_between) || !Number.isFinite(ms_within)) {
    return null;
  }

  const denominator = ms_between + (rater_count - 1) * ms_within;

  if (denominator === 0) {
    return null;
  }

  return round_number((ms_between - ms_within) / denominator, 4);
}

export function infer_tone_from_score(score: number | null, warning_threshold = 40, strong_threshold = 70) {
  if (score === null) {
    return "grey" as const;
  }

  if (score < warning_threshold) {
    return "red" as const;
  }

  if (score < strong_threshold) {
    return "amber" as const;
  }

  return "green" as const;
}

export function infer_validity_status(metric_value: number | null, threshold: number, higher_is_better = true) {
  if (metric_value === null) {
    return "preliminary" as const;
  }

  const passes = higher_is_better ? metric_value >= threshold : metric_value <= threshold;

  if (passes) {
    return "pass" as const;
  }

  const distance = higher_is_better ? threshold - metric_value : metric_value - threshold;
  return distance <= Math.abs(threshold) * 0.15 ? "warning" as const : "fail" as const;
}

export function months_between(left: Date, right: Date) {
  const year_diff = right.getUTCFullYear() - left.getUTCFullYear();
  const month_diff = right.getUTCMonth() - left.getUTCMonth();
  return year_diff * 12 + month_diff;
}

export function average_or_null(values: number[]) {
  return values.length ? round_number(mean(values), 4) : null;
}

export function standard_deviation_or_null(values: number[]) {
  return values.length > 1 ? round_number(standard_deviation(values), 4) : null;
}

export function normalize_likert_to_100(value: number) {
  return round_number(((clamp_number(value, 1, 5) - 1) / 4) * 100, 2);
}

function rank_values(values: number[]) {
  const indexed = values.map((value, index) => ({ index, value })).sort((left, right) => left.value - right.value);
  const ranks = new Array<number>(values.length);

  for (let index = 0; index < indexed.length; ) {
    const start = index;
    const value = indexed[index]!.value;

    while (index < indexed.length && indexed[index]!.value === value) {
      index += 1;
    }

    const average_rank = (start + index + 1) / 2;

    for (let cursor = start; cursor < index; cursor += 1) {
      ranks[indexed[cursor]!.index] = average_rank;
    }
  }

  return ranks;
}
