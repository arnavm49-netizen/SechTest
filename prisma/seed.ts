import { AssessmentLayerCode, AssessmentVersionStatus, CampaignStatus, MeasurementFrequency, Prisma, ReportType, UserRole } from "@prisma/client";
import { pathToFileURL } from "url";
import { hash_password } from "../src/lib/auth/password";
import { complete_assessment_from_invite, record_assessment_consent, save_assessment_response, start_assessment_from_invite } from "../src/lib/assessment-runtime";
import type { AssessmentPublicItem } from "../src/lib/assessment-session";
import { prisma } from "../src/lib/db";
import { DEMO_PASSWORD, DEMO_SUPER_ADMIN_EMAIL, DEMO_SUPER_ADMIN_NAME } from "../src/lib/demo-access";
import { default_scoring_model_config } from "../src/lib/scoring/config";
import { run_scoring_for_assessment } from "../src/lib/scoring-service";
import { build_step_two_question_bank } from "../src/lib/seed/question-bank";
import { build_expanded_question_bank } from "../src/lib/seed/question-bank-expanded";

type SeedOptions = {
  purge_existing?: boolean;
};

export async function seed_demo_dataset(options: SeedOptions = {}) {
  if (options.purge_existing ?? true) {
    await purge_existing_data();
  }

  const default_password_hash = await hash_password(DEMO_PASSWORD);

  const organization = await prisma.organization.create({
    data: {
      dpdp_consent_template:
        "I consent to D&H Secheron collecting, processing, storing, and analysing my assessment responses and related employment data for hiring, development, validity analysis, and reporting in accordance with the DPDP Act 2023 and the organisation's privacy policy.",
      name: "D&H Secheron Psychometrics",
      settings: {
        assessment_time_limit_minutes: 80,
        candidate_feedback_enabled: true,
        compliance: {
          candidate_feedback_enabled: true,
          challenge_process_enabled: true,
          data_fiduciary_registration_required: false,
          retention_raw_responses_months: 12,
          retention_scores_years: 5,
          self_service_access_enabled: true,
        },
        high_contrast_mode_enabled: true,
        locale_primary: "en-IN",
        locale_secondary: "hi-IN",
        multi_rater_config: {
          blind_spot_flag_threshold: 1.5,
          icc_threshold: 0.7,
          max_ratees_per_rater: 8,
          max_raters_per_subject: 8,
          min_raters_per_subject: 4,
        },
      },
    },
  });

  const seed_users = [
    { email: DEMO_SUPER_ADMIN_EMAIL, name: DEMO_SUPER_ADMIN_NAME, role: UserRole.SUPER_ADMIN },
    { email: "hradmin1@secheron.example.com", name: "Riya Sharma", role: UserRole.HR_ADMIN },
    { email: "hradmin2@secheron.example.com", name: "Neha Iyer", role: UserRole.HR_ADMIN },
    { email: "manager1@secheron.example.com", name: "Vikram Sethi", role: UserRole.MANAGER },
    { email: "manager2@secheron.example.com", name: "Ananya Deshmukh", role: UserRole.MANAGER },
    { email: "manager3@secheron.example.com", name: "Rahul Menon", role: UserRole.MANAGER },
    { email: "assessor1@secheron.example.com", name: "Kabir Ahuja", role: UserRole.ASSESSOR },
    { email: "assessor2@secheron.example.com", name: "Simran Gill", role: UserRole.ASSESSOR },
    { email: "candidate1@secheron.example.com", name: "Priya Nair", role: UserRole.CANDIDATE },
    { email: "candidate2@secheron.example.com", name: "Arjun Mehta", role: UserRole.CANDIDATE },
    { email: "candidate3@secheron.example.com", name: "Karthik Rao", role: UserRole.CANDIDATE },
    { email: "candidate4@secheron.example.com", name: "Sneha Verma", role: UserRole.CANDIDATE },
    { email: "candidate5@secheron.example.com", name: "Devansh Patel", role: UserRole.CANDIDATE },
    { email: "rater1@secheron.example.com", name: "Meera Joshi", role: UserRole.RATER },
    { email: "rater2@secheron.example.com", name: "Nitin Bhasin", role: UserRole.RATER },
    { email: "rater3@secheron.example.com", name: "Tanya Sood", role: UserRole.RATER },
    { email: "rater4@secheron.example.com", name: "Harsh Agarwal", role: UserRole.RATER },
  ];

  await prisma.user.createMany({
    data: seed_users.map((user) => ({
      email: user.email,
      name: user.name,
      org_id: organization.id,
      password_hash: default_password_hash,
      role: user.role,
    })),
  });

  const users = await prisma.user.findMany({
    where: { org_id: organization.id },
  });
  const user_lookup = new Map(users.map((user) => [user.email, user]));
  const super_admin = user_lookup.get(DEMO_SUPER_ADMIN_EMAIL);
  const manager_one = user_lookup.get("manager1@secheron.example.com");
  const manager_two = user_lookup.get("manager2@secheron.example.com");
  const manager_three = user_lookup.get("manager3@secheron.example.com");

  if (!super_admin) {
    throw new Error("Expected seeded super admin to exist.");
  }

  await Promise.all(
    [
      {
        demographic_group: "Group A",
        email: "candidate1@secheron.example.com",
        job_title: "Plant Operations Manager",
        manager_id: manager_one?.id,
      },
      {
        demographic_group: "Group B",
        email: "candidate2@secheron.example.com",
        job_title: "Plant Operations Manager",
        manager_id: manager_one?.id,
      },
      {
        demographic_group: "Group A",
        email: "candidate3@secheron.example.com",
        job_title: "Plant Operations Manager",
        manager_id: manager_one?.id,
      },
      {
        demographic_group: "Group B",
        email: "candidate4@secheron.example.com",
        job_title: "Business Unit Analyst",
        manager_id: manager_two?.id,
      },
      {
        demographic_group: "Group A",
        email: "candidate5@secheron.example.com",
        job_title: "Commercial Analyst",
        manager_id: manager_three?.id,
      },
      {
        demographic_group: "Internal",
        email: "manager1@secheron.example.com",
        job_title: "Plant Operations Manager",
        manager_quality_score: 12,
      },
      {
        demographic_group: "Internal",
        email: "manager2@secheron.example.com",
        job_title: "Business Unit Leader",
        manager_quality_score: 9,
      },
      {
        demographic_group: "Internal",
        email: "manager3@secheron.example.com",
        job_title: "Commercial Head",
        manager_quality_score: 11,
      },
    ].map((entry) =>
      prisma.user.update({
        where: { email: entry.email },
        data: {
          demographic_group: entry.demographic_group,
          job_title: entry.job_title,
          manager_id: entry.manager_id,
          manager_quality_score: entry.manager_quality_score,
          profile: {
            locale: "en-IN",
            seeded: true,
          },
        },
      }),
    ),
  );

  const layers = await Promise.all(
    [
      {
        code: AssessmentLayerCode.COGNITIVE,
        default_weight: 25,
        description: "Fluid intelligence and reasoning bandwidth for problem solving under time pressure.",
        name: "Cognitive Ability",
        predictive_evidence: "Target evidence: r = 0.51 with job performance.",
      },
      {
        code: AssessmentLayerCode.PERSONALITY,
        default_weight: 18,
        description: "Broad trait architecture for work style, social orientation, and stability.",
        name: "Personality Traits",
        predictive_evidence: "Target evidence: alpha >= 0.75 with role-appropriate trait-outcome links.",
      },
      {
        code: AssessmentLayerCode.MOTIVATORS,
        default_weight: 12,
        description: "Values, reward preferences, and motivational fit signals.",
        name: "Motivators and Values",
        predictive_evidence: "Target evidence: motivation-role fit predicts turnover and engagement.",
      },
      {
        code: AssessmentLayerCode.EXECUTION,
        default_weight: 22,
        description: "Planning, closure, discipline, and operational work style under delivery pressure.",
        name: "Execution and Work Style",
        predictive_evidence: "Target evidence: scenario-based execution items predict output metrics.",
      },
      {
        code: AssessmentLayerCode.LEADERSHIP,
        default_weight: 13,
        description: "Social influence, people leadership, conflict handling, and delegation.",
        name: "Social and Leadership",
        predictive_evidence: "Target evidence: 360 feedback adds incremental explanatory power.",
      },
      {
        code: AssessmentLayerCode.SJT,
        default_weight: 20,
        description: "Applied judgment in realistic industrial and commercial decision contexts.",
        name: "Situational Judgment",
        predictive_evidence: "Target evidence: SJT scores add incremental validity beyond GMA alone.",
      },
    ].map((layer) =>
      prisma.assessmentLayer.create({
        data: layer,
      }),
    ),
  );

  const layer_lookup = new Map(layers.map((layer) => [layer.code, layer]));

  const sub_dimension_seed: Record<AssessmentLayerCode, string[]> = {
    COGNITIVE: ["Logical reasoning", "Numerical reasoning", "Abstract pattern recognition", "Verbal reasoning"],
    EXECUTION: ["Planning ability", "Prioritisation", "Closure rate", "Process discipline", "Attention to detail"],
    LEADERSHIP: ["Influence", "Conflict handling", "Feedback receptivity", "Delegation", "Team energy"],
    MOTIVATORS: [
      "Financial vs Mastery vs Purpose",
      "Stability vs Growth",
      "Autonomy vs Structure",
      "Power vs Collaboration",
    ],
    PERSONALITY: [
      "Conscientiousness",
      "Openness",
      "Emotional Stability",
      "Extraversion",
      "Agreeableness",
      "Risk Appetite",
      "Bias for Action",
    ],
    SJT: [
      "Problem framing",
      "Stakeholder trade-off navigation",
      "Resource constraint decisions",
      "Escalation judgment",
      "Ethical boundary recognition",
    ],
  };

  const created_sub_dimensions = [];

  for (const [layer_code, names] of Object.entries(sub_dimension_seed) as Array<[AssessmentLayerCode, string[]]>) {
    const layer = layer_lookup.get(layer_code);

    if (!layer) {
      continue;
    }

    for (const name of names) {
      created_sub_dimensions.push(
        await prisma.subDimension.create({
          data: {
            code: name
              .toUpperCase()
              .replaceAll("/", "_")
              .replaceAll(" ", "_"),
            description: `${name} for role-calibrated decision support.`,
            layer_id: layer.id,
            name,
          },
        }),
      );
    }
  }

  const sub_dimension_lookup = new Map(created_sub_dimensions.map((entry) => [entry.name, entry]));

  const role_family_seed = [
    {
      description: "Industrial leadership role balancing plant reliability, people leadership, and judgment under operating constraints.",
      name: "Plant Operations Manager",
      weight_matrix: { COGNITIVE: 18, PERSONALITY: 14, MOTIVATORS: 10, EXECUTION: 24, LEADERSHIP: 14, SJT: 20 },
    },
    {
      description: "Commercial leadership role for high-relationship account growth and execution across strategic customers.",
      name: "Key Account Manager",
      weight_matrix: { COGNITIVE: 15, PERSONALITY: 15, MOTIVATORS: 20, EXECUTION: 15, LEADERSHIP: 20, SJT: 15 },
    },
    {
      description: "Application-led technical role combining analytical horsepower with customer and plant-side problem solving.",
      name: "Application / R&D Engineer",
      weight_matrix: { COGNITIVE: 25, PERSONALITY: 10, MOTIVATORS: 15, EXECUTION: 20, LEADERSHIP: 10, SJT: 20 },
    },
    {
      description: "Business unit leadership role needing balanced commercial, people, and strategic judgment across functions.",
      name: "Business Unit Leader",
      weight_matrix: { COGNITIVE: 20, PERSONALITY: 15, MOTIVATORS: 15, EXECUTION: 15, LEADERSHIP: 20, SJT: 15 },
    },
    {
      description: "Growth-facing sales role in industrial and export contexts where judgment and influence drive outcomes.",
      name: "Sales / BD",
      weight_matrix: { COGNITIVE: 20, PERSONALITY: 15, MOTIVATORS: 10, EXECUTION: 20, LEADERSHIP: 15, SJT: 20 },
    },
    {
      description: "Commercial relationship role focused on strategic account stewardship, negotiation, and delivery integrity.",
      name: "Commercial / KAM",
      weight_matrix: { COGNITIVE: 20, PERSONALITY: 20, MOTIVATORS: 10, EXECUTION: 20, LEADERSHIP: 10, SJT: 20 },
    },
  ];

  await prisma.roleFamily.createMany({
    data: role_family_seed.map((role_family) => ({
      created_by: super_admin.id,
      description: role_family.description,
      name: role_family.name,
      org_id: organization.id,
      weight_matrix: role_family.weight_matrix,
    })),
  });

  const role_families = await prisma.roleFamily.findMany({
    where: { org_id: organization.id },
  });
  const primary_role_family = role_families[0];

  const behaviour_map_seed = [
    {
      behaviour_description: "Written plans are prepared before execution begins.",
      outcome_description: "Fewer mid-project course corrections and smoother handoffs.",
      sub_dimension_name: "Planning ability",
    },
    {
      behaviour_description: "Issues are surfaced early with specific facts and trade-offs.",
      outcome_description: "Faster resolution and lower rework across functions.",
      sub_dimension_name: "Conflict handling",
    },
    {
      behaviour_description: "Stretch-target pursuit is visible and deliberate.",
      outcome_description: "Stronger quota attainment and visible commercial momentum.",
      sub_dimension_name: "Bias for Action",
    },
    {
      behaviour_description: "Commitments are tracked rigorously and closed with guardrails.",
      outcome_description: "Higher on-time dispatch percentage and fewer dropped commitments.",
      sub_dimension_name: "Process discipline",
    },
    {
      behaviour_description: "Cross-functional alignment is created before action accelerates.",
      outcome_description: "Shorter decision-to-action cycles.",
      sub_dimension_name: "Influence",
    },
    {
      behaviour_description: "Outcomes are delegated with checkpoints instead of task dumping.",
      outcome_description: "Higher team throughput and reduced manager bottlenecks.",
      sub_dimension_name: "Delegation",
    },
  ];

  for (const behaviour_map of behaviour_map_seed) {
    const sub_dimension = sub_dimension_lookup.get(behaviour_map.sub_dimension_name);

    if (!sub_dimension) {
      continue;
    }

    await prisma.behaviourMap.create({
      data: {
        behaviour_description: behaviour_map.behaviour_description,
        outcome_description: behaviour_map.outcome_description,
        sub_dimension_id: sub_dimension.id,
      },
    });
  }

  const development_recommendations = [
    {
      recommendation_text:
        "Use a weekly planning ritual, define success criteria before start, and break ambiguous work into first milestones.",
      score_range_max: 60,
      score_range_min: 0,
      sub_dimension_name: "Planning ability",
      timeline: "6 weeks",
    },
    {
      recommendation_text:
        "Practice explicit decision reviews when new data arrives and separate commitment to goals from commitment to one method.",
      score_range_max: 60,
      score_range_min: 0,
      sub_dimension_name: "Openness",
      timeline: "8 weeks",
    },
    {
      recommendation_text:
        "Set stretch goals with visible checkpoints and review progress against leading indicators, not just final outcomes.",
      score_range_max: 60,
      score_range_min: 0,
      sub_dimension_name: "Bias for Action",
      timeline: "6 weeks",
    },
    {
      recommendation_text:
        "Move all commitments into a single tracking system with owners, dates, and explicit close-out criteria.",
      score_range_max: 60,
      score_range_min: 0,
      sub_dimension_name: "Process discipline",
      timeline: "4 weeks",
    },
    {
      recommendation_text:
        "Introduce done definitions, end-of-day closure reviews, and fewer parallel starts.",
      score_range_max: 60,
      score_range_min: 0,
      sub_dimension_name: "Closure rate",
      timeline: "4 weeks",
    },
    {
      recommendation_text:
        "Map stakeholders, tailor the message to each audience, and lead with the business consequence of inaction.",
      score_range_max: 60,
      score_range_min: 0,
      sub_dimension_name: "Influence",
      timeline: "8 weeks",
    },
    {
      recommendation_text:
        "Delegate outcomes, guardrails, and checkpoints, not just tasks; review quality at agreed control points.",
      score_range_max: 60,
      score_range_min: 0,
      sub_dimension_name: "Delegation",
      timeline: "6 weeks",
    },
    {
      recommendation_text:
        "Surface issues early, use specific examples, and resolve around facts, trade-offs, and next actions.",
      score_range_max: 60,
      score_range_min: 0,
      sub_dimension_name: "Conflict handling",
      timeline: "6 weeks",
    },
  ];

  for (const recommendation of development_recommendations) {
    const sub_dimension = sub_dimension_lookup.get(recommendation.sub_dimension_name);

    if (!sub_dimension) {
      continue;
    }

    await prisma.developmentRecommendation.create({
      data: {
        recommendation_text: recommendation.recommendation_text,
        reassessment_trigger: "Next quarterly check-in",
        score_range_max: recommendation.score_range_max,
        score_range_min: recommendation.score_range_min,
        sub_dimension_id: sub_dimension.id,
        timeline: recommendation.timeline,
      },
    });
  }

  const question_bank = build_step_two_question_bank(super_admin.id);

  for (const seed_item of question_bank) {
    const layer = layer_lookup.get(seed_item.layer_code);
    const sub_dimension = sub_dimension_lookup.get(seed_item.sub_dimension_name);

    if (!layer || !sub_dimension) {
      continue;
    }

    const item = await prisma.item.create({
      data: {
        correct_answer: to_nullable_json_input(seed_item.correct_answer),
        created_by: seed_item.created_by,
        desirability_rating: seed_item.desirability_rating ?? null,
        difficulty_b: seed_item.difficulty_b ?? null,
        discrimination_a: seed_item.discrimination_a ?? null,
        guessing_c: seed_item.guessing_c ?? null,
        item_type: seed_item.item_type,
        layer_id: layer.id,
        options: {
          editor_options: seed_item.item_options ?? [],
          tag_metadata: seed_item.tags ?? {},
        },
        review_status: seed_item.review_status,
        scoring_key: to_nullable_json_input(seed_item.scoring_key),
        stem: seed_item.stem,
        sub_dimension_id: sub_dimension.id,
        tags: seed_item.tags ?? {},
        time_limit_seconds: seed_item.time_limit_seconds ?? null,
      },
    });

    if (seed_item.item_options?.length) {
      await prisma.itemOption.createMany({
        data: seed_item.item_options.map((option) => ({
          display_order: option.display_order,
          is_correct: option.is_correct ?? false,
          item_id: item.id,
          option_text: option.option_text,
          score_weight: option.score_weight ?? 0,
        })),
      });
    }

    await prisma.questionVersion.create({
      data: {
        changed_by: super_admin.id,
        change_notes: "Seed version 1",
        item_id: item.id,
        options_snapshot: to_nullable_json_input(seed_item.item_options ?? []),
        scoring_key_snapshot: to_nullable_json_input(seed_item.scoring_key),
        stem_snapshot: seed_item.stem,
        version_number: 1,
      },
    });
  }

  // ── Expanded question bank (fills every type to >= 100 items) ──
  const expanded_bank = build_expanded_question_bank(super_admin.id);

  for (const seed_item of expanded_bank) {
    const layer = layer_lookup.get(seed_item.layer_code);
    const sub_dimension = sub_dimension_lookup.get(seed_item.sub_dimension_name);

    if (!layer || !sub_dimension) {
      continue;
    }

    const item = await prisma.item.create({
      data: {
        correct_answer: to_nullable_json_input(seed_item.correct_answer),
        created_by: seed_item.created_by,
        desirability_rating: seed_item.desirability_rating ?? null,
        difficulty_b: seed_item.difficulty_b ?? null,
        discrimination_a: seed_item.discrimination_a ?? null,
        guessing_c: seed_item.guessing_c ?? null,
        item_type: seed_item.item_type,
        layer_id: layer.id,
        options: {
          editor_options: seed_item.item_options ?? [],
          tag_metadata: seed_item.tags ?? {},
        },
        review_status: seed_item.review_status,
        scoring_key: to_nullable_json_input(seed_item.scoring_key),
        stem: seed_item.stem,
        sub_dimension_id: sub_dimension.id,
        tags: seed_item.tags ?? {},
        time_limit_seconds: seed_item.time_limit_seconds ?? null,
      },
    });

    if (seed_item.item_options?.length) {
      await prisma.itemOption.createMany({
        data: seed_item.item_options.map((option) => ({
          display_order: option.display_order,
          is_correct: option.is_correct ?? false,
          item_id: item.id,
          option_text: option.option_text,
          score_weight: option.score_weight ?? 0,
        })),
      });
    }

    await prisma.questionVersion.create({
      data: {
        changed_by: super_admin.id,
        change_notes: "Expanded seed version 1",
        item_id: item.id,
        options_snapshot: to_nullable_json_input(seed_item.item_options ?? []),
        scoring_key_snapshot: to_nullable_json_input(seed_item.scoring_key),
        stem_snapshot: seed_item.stem,
        version_number: 1,
      },
    });
  }

  const default_norm_group = await prisma.normGroup.create({
    data: {
      description: "Starter all-org norm group for future calibration work.",
      member_count: users.length,
      name: "Initial All-Org Norm",
      org_id: organization.id,
    },
  });

  if (primary_role_family) {
    await prisma.scoringModel.createMany({
      data: [
        {
          config: default_scoring_model_config("PHASE_A_CLASSICAL"),
          created_by: super_admin.id,
          engine_mode: "PHASE_A_CLASSICAL",
          name: "Classical Foundation Engine",
          notes: `Phase A classical scoring with ${default_norm_group.name} as the default norm group.`,
          org_id: organization.id,
          published_at: new Date(),
          published_by: super_admin.id,
          status: "LIVE",
          version_label: "score-v1-classical-live",
        },
        {
          config: default_scoring_model_config("PHASE_B_HYBRID_IRT"),
          created_by: super_admin.id,
          engine_mode: "PHASE_B_HYBRID_IRT",
          name: "Hybrid IRT Challenger",
          notes: "Phase B challenger model for cognitive 3PL and Thurstonian personality scoring.",
          org_id: organization.id,
          published_at: new Date(),
          published_by: super_admin.id,
          status: "CHALLENGER",
          version_label: "score-v2-hybrid-challenger",
        },
        {
          config: default_scoring_model_config("PHASE_B_HYBRID_IRT"),
          created_by: super_admin.id,
          engine_mode: "PHASE_B_HYBRID_IRT",
          name: "Hybrid IRT Draft",
          notes: "Editable draft for threshold tuning and CAT experimentation.",
          org_id: organization.id,
          status: "DRAFT",
          version_label: "score-v2-hybrid-draft",
        },
      ],
    });

    const published_assessment_version = await prisma.assessmentVersion.create({
      data: {
        org_id: organization.id,
        published_at: new Date(),
        published_by: super_admin.id,
        sections_snapshot: [
          {
            break_after: false,
            enabled: true,
            item_count: 12,
            item_type_filters: ["MCQ"],
            layer_code: "COGNITIVE",
            order: 1,
            pagination_style: "single",
            time_limit_seconds: 900,
          },
          {
            break_after: false,
            enabled: true,
            item_count: 12,
            item_type_filters: ["FORCED_CHOICE_TRIAD"],
            layer_code: "PERSONALITY",
            order: 2,
            pagination_style: "single",
            time_limit_seconds: 900,
          },
          {
            break_after: true,
            enabled: true,
            item_count: 20,
            item_type_filters: ["Q_SORT"],
            layer_code: "MOTIVATORS",
            order: 3,
            pagination_style: "section",
            q_sort_distribution: {
              "Important": 6,
              "Least Important": 4,
              "Most Important": 4,
              "Somewhat Important": 6,
            },
            time_limit_seconds: 720,
          },
          {
            break_after: false,
            enabled: true,
            item_count: 12,
            item_type_filters: ["LIKERT", "SCENARIO"],
            layer_code: "EXECUTION",
            order: 4,
            pagination_style: "single",
            time_limit_seconds: 900,
          },
          {
            break_after: false,
            enabled: true,
            item_count: 10,
            item_type_filters: ["SCENARIO"],
            layer_code: "LEADERSHIP",
            order: 5,
            pagination_style: "single",
            tag_filters: {
              audience: "SELF",
            },
            time_limit_seconds: 720,
          },
          {
            break_after: false,
            enabled: true,
            item_count: 8,
            item_type_filters: ["SCENARIO"],
            layer_code: "SJT",
            order: 6,
            pagination_style: "single",
            time_limit_seconds: 660,
          },
        ],
        scoring_config_snapshot: {
          anti_gaming_thresholds: {
            max_flags_before_invalidation: 3,
            max_straight_line_count: 5,
            speed_anomaly_seconds: 3,
          },
          break_point_after_layer: "MOTIVATORS",
          dropout_threshold_pct: 15,
          fallback_mode: "classical",
          pause_resume_rules: {
            allow_pause: true,
            allow_resume: true,
          },
          personality_hiring_allowed: false,
          per_item_timers_enabled: true,
          proctor_mode_default: false,
          publish_notes: "Published seed version for Step 2 candidate flow.",
          question_randomisation: true,
          section_randomisation: false,
          total_battery_time_cap_seconds: 4800,
        },
        status: AssessmentVersionStatus.PUBLISHED,
        version_label: "v2-foundation-published",
      },
    });

    await prisma.assessmentVersion.create({
      data: {
        org_id: organization.id,
        published_by: super_admin.id,
        sections_snapshot: [
          {
            enabled: true,
            item_count: 12,
            item_type_filters: ["MCQ"],
            layer_code: "COGNITIVE",
            order: 1,
            pagination_style: "single",
            time_limit_seconds: 900,
          },
          {
            enabled: true,
            item_count: 12,
            item_type_filters: ["FORCED_CHOICE_TRIAD"],
            layer_code: "PERSONALITY",
            order: 2,
            pagination_style: "single",
            time_limit_seconds: 900,
          },
          {
            enabled: true,
            item_count: 20,
            item_type_filters: ["Q_SORT"],
            layer_code: "MOTIVATORS",
            order: 3,
            pagination_style: "section",
            time_limit_seconds: 720,
          },
          {
            enabled: true,
            item_count: 12,
            item_type_filters: ["LIKERT", "SCENARIO"],
            layer_code: "EXECUTION",
            order: 4,
            pagination_style: "single",
            time_limit_seconds: 900,
          },
          {
            enabled: true,
            item_count: 10,
            item_type_filters: ["SCENARIO"],
            layer_code: "LEADERSHIP",
            order: 5,
            tag_filters: { audience: "SELF" },
            time_limit_seconds: 720,
          },
          {
            enabled: true,
            item_count: 8,
            item_type_filters: ["SCENARIO"],
            layer_code: "SJT",
            order: 6,
            pagination_style: "single",
            time_limit_seconds: 660,
          },
        ],
        scoring_config_snapshot: {
          anti_gaming_thresholds: {
            max_flags_before_invalidation: 3,
            max_straight_line_count: 5,
            speed_anomaly_seconds: 3,
          },
          break_point_after_layer: "MOTIVATORS",
          draft_preview_enabled: true,
          fallback_mode: "classical",
          personality_hiring_allowed: false,
          total_battery_time_cap_seconds: 4800,
        },
        status: AssessmentVersionStatus.DRAFT,
        version_label: "v2-foundation-draft",
      },
    });

    await prisma.reportTemplate.createMany({
      data: [
        {
          branding: {
            accent_color: "#ed3338",
            background_color: "#f0eeee",
            font_family: "Century Schoolbook",
            primary_text: "#000000",
          },
          distribution_rules: {
            audience: ["HR_ADMIN", "MANAGER"],
            embargo_until_publish: true,
          },
          is_active: true,
          name: "Individual Psychometric Summary",
          org_id: organization.id,
          report_type: ReportType.INDIVIDUAL,
          sections_config: ["profile", "role_fit", "development"],
        },
        {
          branding: {
            accent_color: "#ed3338",
            background_color: "#f0eeee",
            font_family: "Century Schoolbook",
            primary_text: "#000000",
          },
          distribution_rules: {
            audience: ["CANDIDATE"],
            simplified_feedback: true,
          },
          is_active: true,
          name: "Candidate Feedback",
          org_id: organization.id,
          report_type: ReportType.CANDIDATE_FEEDBACK,
          sections_config: ["indicator", "strengths", "development"],
        },
        {
          branding: {
            accent_color: "#ed3338",
            background_color: "#f0eeee",
            font_family: "Century Schoolbook",
            primary_text: "#000000",
          },
          distribution_rules: {
            audience: ["HR_ADMIN", "SUPER_ADMIN"],
            embargo_until_publish: false,
          },
          is_active: true,
          name: "Team Heatmap View",
          org_id: organization.id,
          report_type: ReportType.TEAM_HEATMAP,
          sections_config: ["heatmap", "bench_strength", "gaps"],
        },
        {
          branding: {
            accent_color: "#ed3338",
            background_color: "#f0eeee",
            font_family: "Century Schoolbook",
            primary_text: "#000000",
          },
          distribution_rules: {
            audience: ["HR_ADMIN", "SUPER_ADMIN"],
          },
          is_active: true,
          name: "Validity Evidence Report",
          org_id: organization.id,
          report_type: ReportType.VALIDITY,
          sections_config: ["traffic_light_matrix", "alerts", "sample_sizes"],
        },
        {
          branding: {
            accent_color: "#ed3338",
            background_color: "#f0eeee",
            font_family: "Century Schoolbook",
            primary_text: "#000000",
          },
          distribution_rules: {
            audience: ["SUPER_ADMIN", "HR_ADMIN"],
          },
          is_active: true,
          name: "Adverse Impact Report",
          org_id: organization.id,
          report_type: ReportType.ADVERSE_IMPACT,
          sections_config: ["selection_rate_ratios", "flagged_groups", "recommended_actions"],
        },
        {
          branding: {
            accent_color: "#ed3338",
            background_color: "#f0eeee",
            font_family: "Century Schoolbook",
            primary_text: "#000000",
          },
          distribution_rules: {
            audience: ["SUPER_ADMIN", "HR_ADMIN"],
          },
          is_active: true,
          name: "EBITDA Attribution Report",
          org_id: organization.id,
          report_type: ReportType.EBITDA,
          sections_config: ["trait_sensitivity", "simulation", "board_summary"],
        },
      ],
    });

    await prisma.campaign.create({
      data: {
        assessment_version_id: published_assessment_version.id,
        created_by: super_admin.id,
        invite_template: "You are invited to complete the Enterprise Psychometric Assessment for D&H Secheron.",
        name: "Foundation Pilot Campaign",
        org_id: organization.id,
        reminder_template: "Reminder: your psychometric assessment is pending completion.",
        role_family_id: primary_role_family.id,
        settings: {
          reminder_schedule: {
            day_interval: 2,
            enabled: true,
            next_run_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        },
        status: CampaignStatus.ACTIVE,
      },
    });

    await prisma.kpiDefinition.createMany({
      data: [
        {
          data_source: "ERP",
          kpi_description: "On-time dispatch performance for plant leadership roles.",
          kpi_name: "On-time dispatch %",
          measurement_frequency: MeasurementFrequency.MONTHLY,
          measurement_unit: "percent",
          org_id: organization.id,
          prediction_horizon_months: 6,
          role_family_id: primary_role_family.id,
        },
        {
          data_source: "MES",
          kpi_description: "Overall equipment effectiveness trend for plant operations.",
          kpi_name: "Plant OEE",
          measurement_frequency: MeasurementFrequency.MONTHLY,
          measurement_unit: "percent",
          org_id: organization.id,
          prediction_horizon_months: 6,
          role_family_id: primary_role_family.id,
        },
        {
          data_source: "Finance",
          kpi_description: "Cost-per-unit reduction in plant operations.",
          kpi_name: "Cost per unit reduction",
          measurement_frequency: MeasurementFrequency.MONTHLY,
          measurement_unit: "percent",
          org_id: organization.id,
          prediction_horizon_months: 12,
          role_family_id: primary_role_family.id,
        },
      ],
    });

    const active_campaign = await prisma.campaign.findFirst({
      where: {
        name: "Foundation Pilot Campaign",
        org_id: organization.id,
      },
    });

    const candidate_users = users.filter((user) => user.role === UserRole.CANDIDATE).slice(0, 3);

    if (active_campaign) {
      for (const candidate of candidate_users) {
        await prisma.campaignInvite.create({
          data: {
            campaign_id: active_campaign.id,
            candidate_id: candidate.id,
            email: candidate.email,
            expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            invite_token: `seed-${candidate.id}`,
            invited_at: new Date(),
            metadata: {
              seeded: true,
            },
            status: "SENT",
          },
        });
      }
    }

    const invites = await prisma.campaignInvite.findMany({
      where: {
        campaign_id: active_campaign?.id,
      },
      orderBy: { created_at: "asc" },
      take: 3,
    });

    for (const invite of invites) {
      const started_session = await start_assessment_from_invite({
        invite_token: invite.invite_token,
      });

      await record_assessment_consent({
        consent_text: organization.dpdp_consent_template,
        invite_token: invite.invite_token,
      });

      let sequence_number = 1;

      for (const section of started_session.assessment?.sections ?? []) {
        for (const item of section.items) {
          await save_assessment_response({
            invite_token: invite.invite_token,
            item_id: item.id,
            response_time_seconds: 8 + (sequence_number % 5),
            response_value: choose_seed_response(item, sequence_number),
            section_id: section.id,
            sequence_number,
          });
          sequence_number += 1;
        }
      }

      const completed_session = await complete_assessment_from_invite(invite.invite_token);

      if (completed_session.assessment?.id) {
        await prisma.assessment.update({
          where: { id: completed_session.assessment.id },
          data: {
            is_high_stakes: true,
          },
        });

        await run_scoring_for_assessment({
          assessment_id: completed_session.assessment.id,
          org_id: organization.id,
        });
      }
    }

    const completed_assessments = await prisma.assessment.findMany({
      where: {
        deleted_at: null,
        org_id: organization.id,
        status: "COMPLETED",
      },
      include: {
        candidate: true,
        role_fit_results: true,
      },
      orderBy: { completed_at: "asc" },
    });
    const kpi_definitions = await prisma.kpiDefinition.findMany({
      where: {
        deleted_at: null,
        org_id: organization.id,
      },
    });
    const rater_items = await prisma.item.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        assessment_layer: {
          code: "LEADERSHIP",
        },
      },
      include: {
        sub_dimension: true,
      },
    });
    const filtered_rater_items = rater_items.filter((item) => {
      const scoring_key = item.scoring_key && typeof item.scoring_key === "object" ? (item.scoring_key as Record<string, unknown>) : {};
      const tags = item.tags && typeof item.tags === "object" ? (item.tags as Record<string, unknown>) : {};
      return (typeof scoring_key.audience === "string" ? scoring_key.audience : typeof tags.audience === "string" ? tags.audience : null) === "RATER";
    });

    for (const [assessment_index, assessment] of completed_assessments.entries()) {
      for (const [definition_index, definition] of kpi_definitions.entries()) {
        for (let month = 1; month <= 12; month += 1) {
          const observation_date = new Date(Date.UTC(2026, month, 1));
          const value = 55 + assessment_index * 6 + definition_index * 4 + month;

          await prisma.kpiObservation.create({
            data: {
              kpi_definition_id: definition.id,
              observation_date,
              period_end: observation_date,
              period_start: new Date(Date.UTC(2026, Math.max(month - 1, 0), 1)),
              user_id: assessment.candidate_id,
              value,
            },
          });

          await prisma.outcomeRecord.create({
            data: {
              assessment_id: assessment.id,
              kpi_definition_id: definition.id,
              metric_name: definition.kpi_name,
              metric_value: value,
              observation_period: `2026-${String(month).padStart(2, "0")}`,
              user_id: assessment.candidate_id,
            },
          });
        }
      }
    }

    if (completed_assessments[0]) {
      const subject = completed_assessments[0];
      const peer_rater = user_lookup.get("rater1@secheron.example.com");
      const report_rater = user_lookup.get("rater2@secheron.example.com");
      const manager_rater = manager_one;
      const self_rater = subject.candidate;
      const raters_for_cycle: Array<{
        calibration_completed: boolean;
        rater: { id: string };
        relationship: "SELF" | "PEER" | "DIRECT_REPORT" | "MANAGER";
      }> = [];

      if (self_rater) {
        raters_for_cycle.push({ calibration_completed: true, rater: self_rater, relationship: "SELF" });
      }

      if (peer_rater) {
        raters_for_cycle.push({ calibration_completed: true, rater: peer_rater, relationship: "PEER" });
      }

      if (report_rater) {
        raters_for_cycle.push({ calibration_completed: true, rater: report_rater, relationship: "DIRECT_REPORT" });
      }

      if (manager_rater) {
        raters_for_cycle.push({ calibration_completed: true, rater: manager_rater, relationship: "MANAGER" });
      }

      for (const rater_entry of raters_for_cycle) {
        const assignment = await prisma.raterAssignment.create({
          data: {
            assessment_id: subject.id,
            calibration_completed: rater_entry.calibration_completed,
            rater_id: rater_entry.rater.id,
            relationship: rater_entry.relationship,
            status: "COMPLETED",
            subject_id: subject.candidate_id,
          },
        });

        for (const [item_index, item] of filtered_rater_items.entries()) {
          await prisma.raterResponse.create({
            data: {
              item_id: item.id,
              rater_assignment_id: assignment.id,
              response_time_seconds: 12 + (item_index % 4),
              response_value: 3 + ((item_index + assessment_index_offset(rater_entry.relationship)) % 3),
            },
          });
        }
      }
    }

    if (completed_assessments[0]) {
      await prisma.governanceRequest.createMany({
        data: [
          {
            assessment_id: completed_assessments[0].id,
            due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            org_id: organization.id,
            request_note: "Please provide my full score report and the interpretation notes used for the final recommendation.",
            request_type: "ACCESS",
            user_id: completed_assessments[0].candidate_id,
          },
          {
            assessment_id: completed_assessments[0].id,
            due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            org_id: organization.id,
            request_note: "I would like an HR review because I believe my situational judgment result may not reflect my role context.",
            request_type: "CHALLENGE",
            user_id: completed_assessments[0].candidate_id,
          },
        ],
      });
    }
  }

  console.log("Seed completed successfully.");
}

async function main() {
  await seed_demo_dataset({ purge_existing: true });
}

async function purge_existing_data() {
  await prisma.systemHealthCheck.deleteMany();
  await prisma.governanceRequest.deleteMany();
  await prisma.generatedReport.deleteMany();
  await prisma.reportTemplate.deleteMany();
  await prisma.scoredResponse.deleteMany();
  await prisma.scoringRun.deleteMany();
  await prisma.campaignInvite.deleteMany();
  await prisma.outcomeRecord.deleteMany();
  await prisma.kpiObservation.deleteMany();
  await prisma.kpiDefinition.deleteMany();
  await prisma.validityEvidence.deleteMany();
  await prisma.raterResponse.deleteMany();
  await prisma.raterAssignment.deleteMany();
  await prisma.developmentPlan.deleteMany();
  await prisma.roleFitResult.deleteMany();
  await prisma.score.deleteMany();
  await prisma.response.deleteMany();
  await prisma.assessmentSection.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.normGroupMember.deleteMany();
  await prisma.scoringModel.deleteMany();
  await prisma.assessmentVersion.deleteMany();
  await prisma.questionVersion.deleteMany();
  await prisma.itemOption.deleteMany();
  await prisma.item.deleteMany();
  await prisma.normStatistic.deleteMany();
  await prisma.normGroup.deleteMany();
  await prisma.behaviourMap.deleteMany();
  await prisma.developmentRecommendation.deleteMany();
  await prisma.subDimension.deleteMany();
  await prisma.assessmentLayer.deleteMany();
  await prisma.roleFamily.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

function to_nullable_json_input(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function choose_seed_response(item: Pick<AssessmentPublicItem, "item_type" | "options" | "scoring_key">, index: number) {
  const options = item.options ?? [];

  switch (item.item_type) {
    case "MCQ":
    case "SINGLE_CHOICE_TIMED":
      return options.find((option) => option.is_correct)?.option_text ?? options[0]?.option_text ?? null;
    case "SCENARIO":
    case "FORCED_CHOICE_PAIR":
      return [...options].sort((left, right) => (right.score_weight ?? 0) - (left.score_weight ?? 0))[0]?.option_text ?? options[0]?.option_text ?? null;
    case "LIKERT":
      return [4, 3, 2, 4, 3, 2][index % 6];
    case "FORCED_CHOICE_TRIAD": {
      const most = options[index % options.length]?.option_text ?? options[0]?.option_text ?? "Statement 1";
      const least = options[(index + 1) % options.length]?.option_text ?? options[1]?.option_text ?? "Statement 2";
      return { least, most };
    }
    case "Q_SORT": {
      const scoring_key = item.scoring_key && typeof item.scoring_key === "object" ? (item.scoring_key as Record<string, unknown>) : {};
      const distribution = Array.isArray(scoring_key.distribution)
        ? scoring_key.distribution.filter((value): value is string => typeof value === "string")
        : ["Most Important", "Important", "Somewhat Important", "Least Important"];
      return distribution[index % distribution.length];
    }
    default:
      return options[0]?.option_text ?? null;
  }
}

function assessment_index_offset(relationship: string) {
  switch (relationship) {
    case "SELF":
      return 0;
    case "PEER":
      return 1;
    case "DIRECT_REPORT":
      return 2;
    case "MANAGER":
      return 1;
    default:
      return 0;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === entrypoint) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
