import { round_number } from "@/lib/scoring/utils";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function mean(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function variance(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);
  return mean(values.map((value) => (value - average) ** 2));
}

export function standard_deviation(values: number[]) {
  return Math.sqrt(variance(values));
}

export function z_score(value: number, average: number, std_dev: number) {
  if (!Number.isFinite(std_dev) || std_dev <= 0) {
    return 0;
  }

  return (value - average) / std_dev;
}

export function min_max_normalize(value: number, min: number, max: number) {
  if (max <= min) {
    return 50;
  }

  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

export function gaussian_cdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * absolute);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-(absolute * absolute)));

  return 0.5 * (1 + sign * erf);
}

export function percentile_from_z_score(value: number) {
  return clamp(gaussian_cdf(value) * 100, 0, 100);
}

export function build_percentile_lookup(values: number[], breakpoints: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const lookup: Record<string, number> = {};

  if (!sorted.length) {
    return lookup;
  }

  for (const percentile of breakpoints) {
    const safe_percentile = clamp(percentile, 0, 100);
    const position = (safe_percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const weight = position - lower;
    const interpolated = sorted[lower]! + (sorted[upper]! - sorted[lower]!) * weight;
    lookup[String(safe_percentile)] = round_number(interpolated, 4);
  }

  return lookup;
}

export function calculate_cronbach_alpha(matrix: number[][]) {
  const complete_rows = matrix.filter((row) => row.length > 1 && row.every((value) => Number.isFinite(value)));

  if (complete_rows.length < 2) {
    return null;
  }

  const item_count = complete_rows[0]!.length;

  const item_variances = Array.from({ length: item_count }, (_, column_index) =>
    variance(complete_rows.map((row) => row[column_index]!)),
  );
  const total_scores = complete_rows.map((row) => row.reduce((sum, value) => sum + value, 0));
  const total_variance = variance(total_scores);

  if (total_variance <= 0) {
    return null;
  }

  const alpha = (item_count / (item_count - 1)) * (1 - item_variances.reduce((sum, value) => sum + value, 0) / total_variance);
  return round_number(alpha, 4);
}
