import { clamp, percentile_from_z_score } from "@/lib/scoring/math";
import { round_number } from "@/lib/scoring/utils";

export type IrtItemResponse = {
  a: number;
  b: number;
  c: number;
  is_correct: 0 | 1;
};

export function probability_3pl(theta: number, a: number, b: number, c: number) {
  const exponent = -a * (theta - b);
  const logistic = 1 / (1 + Math.exp(exponent));
  return c + (1 - c) * logistic;
}

export function information_3pl(theta: number, a: number, b: number, c: number) {
  const probability = probability_3pl(theta, a, b, c);
  const q = 1 - probability;

  if (probability <= 0 || q <= 0 || 1 - c <= 0) {
    return 0;
  }

  const numerator = a * a * ((probability - c) / (1 - c)) ** 2 * q;
  return numerator / probability;
}

export function standard_error_from_information(information: number) {
  if (information <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return 1 / Math.sqrt(information);
}

export function estimate_theta_3pl(
  responses: IrtItemResponse[],
  input: {
    convergence_delta: number;
    max_iterations: number;
    theta_max: number;
    theta_min: number;
  },
) {
  if (!responses.length) {
    return { standard_error: null, theta: 0 };
  }

  let theta = 0;

  for (let iteration = 0; iteration < input.max_iterations; iteration += 1) {
    let score = 0;
    let information = 0;

    for (const response of responses) {
      const probability = probability_3pl(theta, response.a, response.b, response.c);
      const adjusted_probability = clamp((probability - response.c) / Math.max(1 - response.c, 0.0001), 0.0001, 0.9999);
      score += response.a * (response.is_correct - adjusted_probability);
      information += information_3pl(theta, response.a, response.b, response.c);
    }

    const delta = information > 0 ? score / information : 0;
    theta = clamp(theta + delta, input.theta_min, input.theta_max);

    if (Math.abs(delta) <= input.convergence_delta) {
      const final_information = responses.reduce(
        (sum, response) => sum + information_3pl(theta, response.a, response.b, response.c),
        0,
      );

      return {
        standard_error: round_number(standard_error_from_information(final_information), 4),
        theta: round_number(theta, 4),
      };
    }
  }

  const final_information = responses.reduce((sum, response) => sum + information_3pl(theta, response.a, response.b, response.c), 0);

  return {
    standard_error: round_number(standard_error_from_information(final_information), 4),
    theta: round_number(theta, 4),
  };
}

export function select_next_cat_item<T extends { a: number; b: number; c: number; exposure_count?: number; id: string }>(
  theta: number,
  items: T[],
  administered_ids: string[],
  exposure_penalty_pct: number,
) {
  const administered = new Set(administered_ids);

  const ranked = items
    .filter((item) => !administered.has(item.id))
    .map((item) => {
      const information = information_3pl(theta, item.a, item.b, item.c);
      const exposure_penalty = 1 - Math.min(Math.max((item.exposure_count ?? 0) / 100, 0), 1) * (exposure_penalty_pct / 100);
      return {
        information: information * exposure_penalty,
        item,
      };
    })
    .sort((left, right) => right.information - left.information);

  return ranked[0]?.item ?? null;
}

export function estimate_thurstonian_vector(blocks: Array<{ least_trait: string; most_trait: string; traits: string[] }>) {
  const comparison_map = new Map<string, { comparisons: number; wins: number }>();

  for (const block of blocks) {
    for (const trait of block.traits) {
      comparison_map.set(trait, comparison_map.get(trait) ?? { comparisons: 0, wins: 0 });
    }

    for (const trait of block.traits) {
      if (trait === block.most_trait) {
        comparison_map.get(trait)!.wins += block.traits.length - 1;
      }

      if (trait === block.least_trait) {
        comparison_map.get(trait)!.wins += 0;
      }

      comparison_map.get(trait)!.comparisons += block.traits.length - 1;
    }
  }

  const utilities = Array.from(comparison_map.entries()).map(([trait, stats]) => {
    const ratio = (stats.wins + 0.5) / Math.max(stats.comparisons + 1, 1);
    const clamped = clamp(ratio, 0.001, 0.999);
    return {
      raw_utility: Math.log(clamped / (1 - clamped)),
      trait,
    };
  });

  return utilities.reduce<Record<string, { percentile: number; theta: number }>>((accumulator, entry) => {
    const theta = entry.raw_utility;
    accumulator[entry.trait] = {
      percentile: round_number(percentile_from_z_score(theta), 2),
      theta: round_number(theta, 4),
    };
    return accumulator;
  }, {});
}
