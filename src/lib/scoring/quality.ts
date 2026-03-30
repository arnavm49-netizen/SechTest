import type { ResponseQualityFlag, ScoringModelConfig, ScoringResponse } from "@/lib/scoring/types";

export function evaluate_response_quality(responses: ScoringResponse[], config: ScoringModelConfig): ResponseQualityFlag[] {
  const flags: ResponseQualityFlag[] = [];

  for (const response of responses) {
    const response_time_seconds = response.response_time_seconds ?? 0;

    if (response_time_seconds > 0 && response_time_seconds < config.quality.speed_anomaly_seconds) {
      flags.push({
        item_id: response.item.id,
        reason: "speed_anomaly",
        response_time_seconds,
      });
    }
  }

  const timed_responses = responses.filter((response) => (response.response_time_seconds ?? 0) > 0);
  const average_response_time =
    timed_responses.reduce((sum, response) => sum + (response.response_time_seconds ?? 0), 0) / Math.max(timed_responses.length, 1);

  if (timed_responses.length >= 5 && average_response_time < config.quality.disengagement_seconds) {
    flags.push({
      detail: "Average response time is below the disengagement threshold.",
      reason: "disengagement",
      response_time_seconds: average_response_time,
    });
  }

  const likert_values = responses
    .filter((response) => response.item.item_type === "LIKERT" && typeof response.response_value === "number")
    .map((response) => response.response_value as number);
  const straight_line_threshold = config.quality.max_straight_line_count + 1;

  if (likert_values.length >= straight_line_threshold) {
    let run_length = 1;
    let last_value = likert_values[0];

    for (let index = 1; index < likert_values.length; index += 1) {
      const current = likert_values[index];
      run_length = current === last_value ? run_length + 1 : 1;
      last_value = current;

      if (run_length >= straight_line_threshold) {
        flags.push({
          count: run_length,
          reason: "straight_lining",
          value: current,
        });
        break;
      }
    }
  }

  const extreme_count = likert_values.filter((value) => value === 1 || value === 5).length;
  const extreme_ratio = likert_values.length ? extreme_count / likert_values.length : 0;

  if (likert_values.length >= 6 && extreme_ratio >= config.quality.extreme_response_ratio) {
    flags.push({
      count: extreme_count,
      detail: "High concentration of extreme Likert responses.",
      reason: "extreme_responding",
      value: Number(extreme_ratio.toFixed(2)),
    });
  }

  return flags;
}

export function should_invalidate(flags: ResponseQualityFlag[], config: ScoringModelConfig) {
  return flags.length > config.quality.max_flags_before_invalidation;
}
