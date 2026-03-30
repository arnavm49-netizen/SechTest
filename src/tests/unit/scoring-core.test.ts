import { describe, expect, it } from "vitest";
import {
  aggregate_weighted_layer_score,
  build_development_gaps,
  compute_role_fit,
  get_role_fit_recommendation,
  normalize_construct_score,
} from "@/lib/scoring/aggregation";
import { calculate_speed_score, score_classical_response } from "@/lib/scoring/classical";
import { default_scoring_model_config, normalize_scoring_model_config, resolve_ideal_ranges } from "@/lib/scoring/config";
import { estimate_theta_3pl, estimate_thurstonian_vector, information_3pl, probability_3pl, select_next_cat_item, standard_error_from_information } from "@/lib/scoring/irt";
import { build_percentile_lookup, calculate_cronbach_alpha, clamp, gaussian_cdf, mean, min_max_normalize, percentile_from_z_score, standard_deviation, variance, z_score } from "@/lib/scoring/math";
import { evaluate_response_quality, should_invalidate } from "@/lib/scoring/quality";
import { as_array, as_number, as_record, as_string, round_number } from "@/lib/scoring/utils";

const phase_a_config = default_scoring_model_config("PHASE_A_CLASSICAL");
const phase_b_config = default_scoring_model_config("PHASE_B_HYBRID_IRT");

describe("scoring utils", () => {
  it("normalizes primitive helpers", () => {
    expect(as_array([1, 2])).toEqual([1, 2]);
    expect(as_array("x")).toEqual([]);
    expect(as_number(5)).toBe(5);
    expect(as_number("5")).toBeNull();
    expect(as_record({ ok: true })).toEqual({ ok: true });
    expect(as_record(["nope"])).toBeNull();
    expect(as_string(" hello ")).toBe("hello");
    expect(as_string("   ")).toBeNull();
    expect(round_number(12.3456, 2)).toBe(12.35);
  });
});

describe("scoring math", () => {
  it("covers descriptive stats and normalization helpers", () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(mean([])).toBe(0);
    expect(mean([10, 20, 30])).toBe(20);
    expect(variance([5])).toBe(0);
    expect(variance([10, 20, 30])).toBeCloseTo(66.6667, 3);
    expect(standard_deviation([10, 20, 30])).toBeCloseTo(8.165, 3);
    expect(z_score(10, 10, 0)).toBe(0);
    expect(z_score(60, 50, 10)).toBe(1);
    expect(min_max_normalize(5, 5, 5)).toBe(50);
    expect(min_max_normalize(15, 0, 10)).toBe(100);
    expect(gaussian_cdf(0)).toBeCloseTo(0.5, 3);
    expect(percentile_from_z_score(0)).toBeCloseTo(50, 3);
    expect(build_percentile_lookup([], [50])).toEqual({});
    expect(build_percentile_lookup([10, 20, 30, 40], [25, 50, 75])).toEqual({
      "25": 17.5,
      "50": 25,
      "75": 32.5,
    });
    expect(calculate_cronbach_alpha([[1], [2]])).toBeNull();
    expect(calculate_cronbach_alpha([[10, 10], [10, 10]])).toBeNull();
    expect(calculate_cronbach_alpha([
      [65, 70, 75],
      [55, 60, 68],
      [72, 78, 80],
      [48, 52, 58],
    ])).toBeCloseTo(0.9943, 4);
  });
});

describe("scoring config", () => {
  it("builds defaults, merges partials, and resolves ideal ranges", () => {
    expect(phase_a_config.cat.enabled).toBe(false);
    expect(phase_b_config.cat.enabled).toBe(true);

    const merged = normalize_scoring_model_config(
      {
        cognitive: {
          accuracy_weight_pct: 80,
          default_time_limit_seconds: 90,
          speed_floor_pct: 5,
          speed_weight_pct: 20,
        },
        role_fit: {
          default_ideal_ranges: {
            COGNITIVE: { max: 100, min: 70 },
          },
          role_family_ideal_ranges: {
            "Plant Operations Manager": {
              EXECUTION: { max: 100, min: 75 },
            },
          },
        },
      },
      "PHASE_B_HYBRID_IRT",
    );

    expect(merged.cognitive.accuracy_weight_pct).toBe(80);
    expect(resolve_ideal_ranges(merged, "Plant Operations Manager")).toMatchObject({
      COGNITIVE: { max: 100, min: 70 },
      EXECUTION: { max: 100, min: 75 },
    });
    expect(resolve_ideal_ranges(merged, "Unknown Role")).toMatchObject({
      COGNITIVE: { max: 100, min: 70 },
    });
    expect(
      normalize_scoring_model_config(
        {
          role_fit: {
            default_ideal_ranges: {
              INVALID: { max: 120, min: -10 },
            },
            role_family_ideal_ranges: {
              Sales: {
                COGNITIVE: { max: 95, min: 45 },
                INVALID: { max: 999, min: 0 },
              },
            },
          },
        },
        "PHASE_A_CLASSICAL",
      ).role_fit.role_family_ideal_ranges,
    ).toEqual({
      Sales: {
        COGNITIVE: { max: 95, min: 45 },
      },
    });
  });
});

describe("IRT helpers", () => {
  it("computes probabilities, information, theta, CAT selection, and thurstonian vectors", () => {
    expect(probability_3pl(0, 1.2, 0, 0.2)).toBeCloseTo(0.6, 1);
    expect(information_3pl(0, 1.2, 0, 0.2)).toBeGreaterThan(0);
    expect(information_3pl(0, 1.2, 0, 1)).toBe(0);
    expect(standard_error_from_information(0)).toBe(Number.POSITIVE_INFINITY);
    expect(standard_error_from_information(4)).toBe(0.5);
    expect(estimate_theta_3pl([], phase_b_config.irt)).toEqual({ standard_error: null, theta: 0 });

    const theta = estimate_theta_3pl(
      [
        { a: 1.1, b: -0.8, c: 0.2, is_correct: 1 },
        { a: 1.2, b: 0, c: 0.2, is_correct: 1 },
        { a: 1.0, b: 0.6, c: 0.2, is_correct: 0 },
      ],
      phase_b_config.irt,
    );
    expect(theta.theta).toBeGreaterThan(-4);
    expect(theta.theta).toBeLessThan(4);
    expect(theta.standard_error).not.toBeNull();
    expect(
      estimate_theta_3pl(
        [{ a: 1, b: 0, c: 1, is_correct: 1 }],
        {
          ...phase_b_config.irt,
          max_iterations: 1,
        },
      ),
    ).toEqual({
      standard_error: Number.POSITIVE_INFINITY,
      theta: 0,
    });

    expect(
      select_next_cat_item(
        0.4,
        [
          { a: 1.2, b: 0.4, c: 0.2, exposure_count: 10, id: "item-1" },
          { a: 1.6, b: 0.3, c: 0.2, exposure_count: 95, id: "item-2" },
          { a: 1.4, b: 0.5, c: 0.2, exposure_count: 5, id: "item-3" },
        ],
        ["item-1"],
        50,
      )?.id,
    ).toBe("item-3");
    expect(select_next_cat_item(0, [], [], 20)).toBeNull();

    expect(
      estimate_thurstonian_vector([
        { least_trait: "Openness", most_trait: "Conscientiousness", traits: ["Conscientiousness", "Openness", "Extraversion"] },
        { least_trait: "Extraversion", most_trait: "Conscientiousness", traits: ["Conscientiousness", "Extraversion", "Risk Appetite"] },
      ]),
    ).toMatchObject({
      Conscientiousness: { theta: expect.any(Number) },
      Extraversion: { theta: expect.any(Number) },
      Openness: { theta: expect.any(Number) },
      "Risk Appetite": { theta: expect.any(Number) },
    });
  });
});

describe("quality gates", () => {
  it("captures speed, disengagement, straight-lining, and extreme responding", () => {
    const flags = evaluate_response_quality(
      [
        ...Array.from({ length: 6 }, (_, index) => ({
          assessment_id: "assessment-1",
          id: `response-${index + 1}`,
          item: {
            difficulty_b: null,
            discrimination_a: null,
            guessing_c: null,
            id: `item-${index + 1}`,
            item_type: "LIKERT" as const,
            layer_code: "EXECUTION" as const,
            options: [],
            scoring_key: null,
            stem: "Item",
            sub_dimension_id: "sub-1",
            sub_dimension_name: "Process discipline",
            time_limit_seconds: 45,
          },
          response_time_seconds: 2,
          response_value: 5,
          sequence_number: index + 1,
        })),
      ],
      phase_a_config,
    );

    expect(flags.map((flag) => flag.reason)).toContain("speed_anomaly");
    expect(flags.map((flag) => flag.reason)).toContain("disengagement");
    expect(flags.map((flag) => flag.reason)).toContain("straight_lining");
    expect(flags.map((flag) => flag.reason)).toContain("extreme_responding");
    expect(should_invalidate(flags, phase_a_config)).toBe(true);
    expect(should_invalidate(flags.slice(0, 3), phase_a_config)).toBe(false);
  });

  it("returns no quality flags when behavior is clean", () => {
    expect(
      evaluate_response_quality(
        Array.from({ length: 5 }, (_, index) => ({
          assessment_id: "assessment-2",
          id: `response-clean-${index + 1}`,
          item: {
            difficulty_b: null,
            discrimination_a: null,
            guessing_c: null,
            id: `item-clean-${index + 1}`,
            item_type: index < 3 ? ("LIKERT" as const) : ("SCENARIO" as const),
            layer_code: "EXECUTION" as const,
            options: [],
            scoring_key: null,
            stem: "Item",
            sub_dimension_id: "sub-2",
            sub_dimension_name: "Planning ability",
            time_limit_seconds: 45,
          },
          response_time_seconds: 9,
          response_value: index < 3 ? index + 2 : "Scenario option",
          sequence_number: index + 1,
        })),
        phase_a_config,
      ),
    ).toEqual([]);
  });
});

describe("classical scoring", () => {
  it("scores all supported item formats and speed logic branches", () => {
    const mcq = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-mcq",
        item: {
          difficulty_b: 0,
          discrimination_a: 1.1,
          guessing_c: 0.2,
          id: "item-mcq",
          item_type: "MCQ",
          layer_code: "COGNITIVE",
          options: [
            { display_order: 1, is_correct: true, option_text: "A", score_weight: 1 },
            { display_order: 2, is_correct: false, option_text: "B", score_weight: 0 },
          ],
          scoring_key: { accuracy_weight: 0.7, correct_option: "A", speed_weight: 0.3 },
          stem: "Question",
          sub_dimension_id: "sub-mcq",
          sub_dimension_name: "Logical reasoning",
          time_limit_seconds: 60,
        },
        response_time_seconds: 12,
        response_value: "A",
        sequence_number: 1,
      },
      phase_a_config,
    );
    const wrong_mcq = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-mcq-wrong",
        item: {
          ...mcqBase(),
          sub_dimension_id: "sub-mcq",
          sub_dimension_name: "Logical reasoning",
        },
        response_time_seconds: 5,
        response_value: "B",
        sequence_number: 2,
      },
      phase_a_config,
    );
    const likert = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-likert",
        item: {
          difficulty_b: null,
          discrimination_a: null,
          guessing_c: null,
          id: "item-likert",
          item_type: "LIKERT",
          layer_code: "EXECUTION",
          options: [],
          scoring_key: { reverse_scored: true },
          stem: "Likert",
          sub_dimension_id: "sub-likert",
          sub_dimension_name: "Closure rate",
          time_limit_seconds: 45,
        },
        response_time_seconds: 6,
        response_value: 2,
        sequence_number: 3,
      },
      phase_a_config,
    );
    const scenario = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-scenario",
        item: {
          difficulty_b: null,
          discrimination_a: null,
          guessing_c: null,
          id: "item-scenario",
          item_type: "SCENARIO",
          layer_code: "SJT",
          options: [
            { display_order: 1, option_text: "Option A", score_weight: 4 },
            { display_order: 2, option_text: "Option B", score_weight: 1 },
          ],
          scoring_key: { model: "partial_credit_0_4" },
          stem: "Scenario",
          sub_dimension_id: "sub-scenario",
          sub_dimension_name: "Decision quality",
          time_limit_seconds: 90,
        },
        response_time_seconds: 20,
        response_value: "Option A",
        sequence_number: 4,
      },
      phase_a_config,
    );
    const qsort = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-qsort",
        item: {
          difficulty_b: null,
          discrimination_a: null,
          guessing_c: null,
          id: "item-qsort",
          item_type: "Q_SORT",
          layer_code: "MOTIVATORS",
          options: [],
          scoring_key: {
            archetype_cluster_hint: "Mastery",
            distribution: ["Most Important", "Important", "Somewhat Important", "Least Important"],
          },
          stem: "Motivator",
          sub_dimension_id: "sub-qsort",
          sub_dimension_name: "Growth",
          time_limit_seconds: null,
        },
        response_time_seconds: null,
        response_value: "Important",
        sequence_number: 5,
      },
      phase_a_config,
    );
    const triad = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-triad",
        item: {
          difficulty_b: null,
          discrimination_a: null,
          guessing_c: null,
          id: "item-triad",
          item_type: "FORCED_CHOICE_TRIAD",
          layer_code: "PERSONALITY",
          options: [
            { display_order: 1, option_text: "Structured", score_weight: 0 },
            { display_order: 2, option_text: "Curious", score_weight: 0 },
            { display_order: 3, option_text: "Outgoing", score_weight: 0 },
          ],
          scoring_key: {
            statements: [
              { trait: "Conscientiousness" },
              { trait: "Openness" },
              { trait: "Extraversion" },
            ],
          },
          stem: "Triad",
          sub_dimension_id: "sub-triad",
          sub_dimension_name: "Conscientiousness",
          time_limit_seconds: 75,
        },
        response_time_seconds: 10,
        response_value: { least: "Outgoing", most: "Structured" },
        sequence_number: 6,
      },
      phase_a_config,
    );
    const pair = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-pair",
        item: {
          difficulty_b: null,
          discrimination_a: null,
          guessing_c: null,
          id: "item-pair",
          item_type: "FORCED_CHOICE_PAIR",
          layer_code: "PERSONALITY",
          options: [
            { display_order: 1, option_text: "Option A", score_weight: 20 },
            { display_order: 2, option_text: "Option B", score_weight: 80 },
          ],
          scoring_key: {
            option_scores: {
              "Option A": 35,
              "Option B": 75,
            },
          },
          stem: "Pair",
          sub_dimension_id: "sub-pair",
          sub_dimension_name: "Bias for Action",
          time_limit_seconds: 60,
        },
        response_time_seconds: 8,
        response_value: "Option B",
        sequence_number: 7,
      },
      phase_a_config,
    );
    const pair_fallback = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-pair-fallback",
        item: {
          difficulty_b: null,
          discrimination_a: null,
          guessing_c: null,
          id: "item-pair-fallback",
          item_type: "FORCED_CHOICE_PAIR",
          layer_code: "PERSONALITY",
          options: [
            { display_order: 1, option_text: "Low", score_weight: 10 },
            { display_order: 2, option_text: "High", score_weight: 90 },
          ],
          scoring_key: {},
          stem: "Pair fallback",
          sub_dimension_id: "sub-pair-fallback",
          sub_dimension_name: "Risk Appetite",
          time_limit_seconds: 60,
        },
        response_time_seconds: 9,
        response_value: "High",
        sequence_number: 8,
      },
      phase_a_config,
    );
    const numeric_scenario = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-scenario-numeric",
        item: {
          difficulty_b: null,
          discrimination_a: null,
          guessing_c: null,
          id: "item-scenario-numeric",
          item_type: "SCENARIO",
          layer_code: "SJT",
          options: [
            { display_order: 1, option_text: "One", score_weight: 1 },
            { display_order: 2, option_text: "Four", score_weight: 4 },
          ],
          scoring_key: { model: "partial_credit_0_4" },
          stem: "Numeric scenario",
          sub_dimension_id: "sub-scenario-numeric",
          sub_dimension_name: "Escalation judgment",
          time_limit_seconds: 90,
        },
        response_time_seconds: 22,
        response_value: 4,
        sequence_number: 9,
      },
      phase_a_config,
    );
    const unmatched_scenario = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-scenario-null",
        item: {
          difficulty_b: null,
          discrimination_a: null,
          guessing_c: null,
          id: "item-scenario-null",
          item_type: "SCENARIO",
          layer_code: "SJT",
          options: [{ display_order: 1, option_text: "Only", score_weight: 4 }],
          scoring_key: { model: "partial_credit_0_4" },
          stem: "Null scenario",
          sub_dimension_id: "sub-scenario-null",
          sub_dimension_name: "Problem framing",
          time_limit_seconds: 90,
        },
        response_time_seconds: 18,
        response_value: { unsupported: true },
        sequence_number: 10,
      },
      phase_a_config,
    );
    const unsupported = score_classical_response(
      {
        assessment_id: "assessment-1",
        id: "response-unsupported",
        item: {
          difficulty_b: null,
          discrimination_a: null,
          guessing_c: null,
          id: "item-unsupported",
          item_type: "SIMULATION",
          layer_code: "EXECUTION",
          options: [],
          scoring_key: null,
          stem: "Unsupported",
          sub_dimension_id: null,
          sub_dimension_name: null,
          time_limit_seconds: 60,
        },
        response_time_seconds: null,
        response_value: null,
        sequence_number: 8,
      },
      phase_a_config,
    );

    expect(mcq.scored_value).toBeGreaterThan(70);
    expect(wrong_mcq.scored_value).toBe(0);
    expect(likert.scored_value).toBe(75);
    expect(scenario.scored_value).toBe(100);
    expect(qsort.scored_value).toBeCloseTo(66.67, 1);
    expect(triad.explanation).toMatchObject({
      model: "forced_choice_triad_rank",
      trait_contributions: expect.arrayContaining([
        expect.objectContaining({ raw_score: 100, sub_dimension_name: "Conscientiousness" }),
        expect.objectContaining({ raw_score: 0, sub_dimension_name: "Extraversion" }),
      ]),
    });
    expect(pair.scored_value).toBe(75);
    expect(pair_fallback.scored_value).toBe(100);
    expect(numeric_scenario.scored_value).toBe(100);
    expect(unmatched_scenario.scored_value).toBe(0);
    expect(unsupported.scored_value).toBeNull();
    expect(calculate_speed_score(null, 60, 0.1)).toBe(1);
    expect(calculate_speed_score(90, 60, 0.1)).toBe(0.1);
  });
});

describe("aggregation and role fit", () => {
  it("normalizes constructs, computes role fit, and builds development gaps", () => {
    expect(
      aggregate_weighted_layer_score(
        "EXECUTION",
        [
          { label: "Self", score: 62, weight_pct: 40 },
          { label: "Scenario", score: 80, weight_pct: 60 },
        ],
        true,
      ),
    ).toMatchObject({
      normalized_score_0_100: 72.8,
      raw_score: 72.8,
    });

    expect(
      normalize_construct_score({
        comparability: "WITHIN_PERSON_ONLY",
        phase: "PHASE_A_CLASSICAL",
        raw_score: 72,
        raw_score_max: 100,
        raw_score_min: 0,
      }),
    ).toEqual({
      normalized_score_0_100: 72,
      percentile: 50,
      z_score: 0,
    });

    expect(
      normalize_construct_score({
        comparability: "INTER_PERSON",
        norm_mean: 0,
        norm_std_dev: 1,
        phase: "PHASE_B_HYBRID_IRT",
        raw_score: 1,
        raw_score_max: 4,
        raw_score_min: -4,
      }).normalized_score_0_100,
    ).toBeGreaterThan(80);

    expect(get_role_fit_recommendation(82, phase_a_config.fit_thresholds)).toBe("STRONG_FIT");
    expect(get_role_fit_recommendation(70, phase_a_config.fit_thresholds)).toBe("FIT");
    expect(get_role_fit_recommendation(50, phase_a_config.fit_thresholds)).toBe("DEVELOP");
    expect(get_role_fit_recommendation(30, phase_a_config.fit_thresholds)).toBe("POOR_FIT");

    const role_fit = compute_role_fit({
      ideal_ranges: {
        COGNITIVE: { max: 100, min: 60 },
        EXECUTION: { max: 100, min: 70 },
        SJT: { max: 100, min: 65 },
      },
      included_layers: ["COGNITIVE", "EXECUTION", "SJT"],
      layer_scores: {
        COGNITIVE: 84,
        EXECUTION: 66,
        LEADERSHIP: 40,
        MOTIVATORS: 50,
        PERSONALITY: 55,
        SJT: 74,
      },
      thresholds: phase_a_config.fit_thresholds,
      weight_matrix: {
        COGNITIVE: 40,
        EXECUTION: 35,
        SJT: 25,
      },
    });

    expect(role_fit.fit_score_pct).toBeGreaterThan(70);
    expect(role_fit.top_3_drivers[0]?.layer_code).toBe("COGNITIVE");
    expect(role_fit.top_2_constraints[0]?.layer_code).toBe("EXECUTION");
    expect(role_fit.excluded_layers).toEqual(expect.arrayContaining(["LEADERSHIP", "MOTIVATORS", "PERSONALITY"]));
    expect(
      compute_role_fit({
        ideal_ranges: {
          COGNITIVE: { max: 90, min: 60 },
        },
        included_layers: ["COGNITIVE", "EXECUTION"],
        layer_scores: {
          COGNITIVE: 98,
          EXECUTION: 35,
          LEADERSHIP: 20,
          MOTIVATORS: 10,
          PERSONALITY: 10,
          SJT: 10,
        },
        thresholds: phase_a_config.fit_thresholds,
        weight_matrix: {
          COGNITIVE: 60,
          EXECUTION: 40,
        },
      }).top_2_constraints[0]?.layer_code,
    ).toBe("COGNITIVE");

    expect(
      build_development_gaps({
        construct_scores: [
          {
            normalized_score_0_100: 38,
            percentile: 35,
            recommendation_texts: ["Build a weekly planning ritual."],
            sub_dimension_id: "sub-1",
            sub_dimension_name: "Planning ability",
          },
          {
            normalized_score_0_100: 72,
            percentile: 68,
            recommendation_texts: [],
            sub_dimension_id: "sub-2",
            sub_dimension_name: "Delegation",
          },
          {
            normalized_score_0_100: 15,
            percentile: 10,
            recommendation_texts: ["Introduce done definitions."],
            sub_dimension_id: "sub-3",
            sub_dimension_name: "Closure rate",
          },
        ],
        gap_percentile_threshold: 40,
        high_stakes_gap_threshold: 20,
      }),
    ).toEqual([
      {
        high_stakes_gap: true,
        percentile: 10,
        recommendation_texts: ["Introduce done definitions."],
        score_0_100: 15,
        sub_dimension_id: "sub-3",
        sub_dimension_name: "Closure rate",
      },
      {
        high_stakes_gap: false,
        percentile: 35,
        recommendation_texts: ["Build a weekly planning ritual."],
        score_0_100: 38,
        sub_dimension_id: "sub-1",
        sub_dimension_name: "Planning ability",
      },
    ]);
  });
});

function mcqBase() {
  return {
    difficulty_b: 0,
    discrimination_a: 1.1,
    guessing_c: 0.2,
    id: "item-mcq-2",
    item_type: "MCQ" as const,
    layer_code: "COGNITIVE" as const,
    options: [
      { display_order: 1, is_correct: true, option_text: "A", score_weight: 1 },
      { display_order: 2, is_correct: false, option_text: "B", score_weight: 0 },
    ],
    scoring_key: { accuracy_weight: 0.7, correct_option: "A", speed_weight: 0.3 },
    stem: "Question",
    time_limit_seconds: 60,
  };
}
