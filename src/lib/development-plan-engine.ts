/**
 * Development Plan Engine
 *
 * Generates detailed, actionable 90-day development plans based on assessment results.
 * Each plan includes specific interventions with actions, success criteria, and timelines.
 */

type GapDimension = {
  sub_dimension_name: string;
  score_0_100: number | null;
  layer_code: string;
  recommendation_texts: string[];
  high_stakes_gap: boolean;
};

type InterventionTemplate = {
  intervention_type: string;
  title: string;
  description: string;
  actions: string[];
  success_criteria: string;
  timeline_weeks: number;
};

type GeneratedIntervention = InterventionTemplate & {
  sub_dimension_name: string;
  gap_score: number;
  target_score: number;
  priority: number;
};

type PlanOutput = {
  plan_summary: string;
  interventions: GeneratedIntervention[];
  target_review_date_weeks: number;
};

// ── Intervention library by dimension and score band ──

const INTERVENTION_LIBRARY: Record<string, Record<string, InterventionTemplate[]>> = {
  // ── COGNITIVE ──
  "Logical reasoning": {
    low: [
      {
        intervention_type: "STRUCTURED_PRACTICE",
        title: "Logical reasoning foundations",
        description: "Build core logical reasoning through structured daily practice with conditional, syllogistic, and sequential reasoning problems.",
        actions: [
          "Complete 3 logic puzzles daily for 4 weeks (start with easy, progress to medium)",
          "Read chapters 1-4 of a structured thinking guide and summarise key rules",
          "Practice identifying premises and conclusions in business memos (2 per week)",
          "Ask a peer to review your reasoning chain on one decision per week",
        ],
        success_criteria: "Can consistently identify valid vs invalid conclusions in 4-step logical chains. Peers report clearer reasoning in discussions.",
        timeline_weeks: 6,
      },
    ],
    medium: [
      {
        intervention_type: "APPLIED_PRACTICE",
        title: "Complex reasoning under constraints",
        description: "Strengthen reasoning with multi-variable problems, trade-off analysis, and time-pressured decision frameworks.",
        actions: [
          "Solve 2 multi-variable logic problems per week (business case format)",
          "Lead one structured trade-off analysis in a team meeting per week",
          "Write a one-page decision memo with explicit logical steps for one decision per fortnight",
          "Debrief with your manager on the reasoning quality of your last 3 decisions",
        ],
        success_criteria: "Decision memos show clear logical structure. Manager confirms improved reasoning quality in complex situations.",
        timeline_weeks: 8,
      },
    ],
  },
  "Numerical reasoning": {
    low: [
      {
        intervention_type: "SKILL_BUILDING",
        title: "Numerical fluency programme",
        description: "Build confidence with percentages, ratios, growth rates, and operational metrics through daily practice.",
        actions: [
          "Complete 20 minutes of numerical reasoning practice daily for 4 weeks",
          "Recreate 2 financial calculations from recent reports by hand each week",
          "Ask finance to walk you through one monthly report — take notes on the maths",
          "Present one data-backed recommendation to your team using numbers, not just narrative",
        ],
        success_criteria: "Can calculate growth rates, margins, and ratios without a calculator. Reports contain accurate numerical analysis.",
        timeline_weeks: 6,
      },
    ],
    medium: [
      {
        intervention_type: "APPLIED_PRACTICE",
        title: "Data-driven decision making",
        description: "Move from numerical competence to using data as a strategic tool in decisions and presentations.",
        actions: [
          "Build one data dashboard or summary for your team using real operational metrics",
          "Challenge one assumption per week by running the numbers independently",
          "Present a quarterly trend analysis to your manager with commentary on drivers",
          "Identify one cost or efficiency opportunity using numerical analysis",
        ],
        success_criteria: "Independently produces accurate numerical analyses. Identifies data-driven opportunities proactively.",
        timeline_weeks: 8,
      },
    ],
  },

  // ── PERSONALITY ──
  Conscientiousness: {
    low: [
      {
        intervention_type: "HABIT_FORMATION",
        title: "Personal organisation system",
        description: "Build reliable work habits through a personal productivity system with accountability checkpoints.",
        actions: [
          "Set up a task management system (digital or paper) and use it daily for 30 days",
          "Create end-of-day review habit: list what was completed, what rolled over, and why",
          "Set calendar reminders for all commitments within 1 hour of making them",
          "Ask a trusted peer to check in weekly on your commitment follow-through",
          "Identify your top 3 'commitment leaks' (where things slip) and design a fix for each",
        ],
        success_criteria: "Zero missed deadlines for 4 consecutive weeks. Peers report improved reliability.",
        timeline_weeks: 6,
      },
    ],
    medium: [
      {
        intervention_type: "PERFORMANCE_COACHING",
        title: "Operational discipline upgrade",
        description: "Elevate from reliable to systematically excellent through process ownership and proactive quality control.",
        actions: [
          "Document your top 5 recurring processes as personal SOPs",
          "Introduce a pre-send checklist for all reports and external communications",
          "Volunteer to own one process improvement in your team over 8 weeks",
          "Track and report your own error rate weekly (self-audit)",
        ],
        success_criteria: "Personal SOPs documented and in use. Error rate reduced by 50%. Process improvement delivered.",
        timeline_weeks: 8,
      },
    ],
  },
  "Emotional Stability": {
    low: [
      {
        intervention_type: "SELF_MANAGEMENT",
        title: "Pressure management programme",
        description: "Build resilience and composure through awareness, reframing techniques, and recovery practices.",
        actions: [
          "Keep a pressure diary for 2 weeks: record triggers, reactions, and recovery time",
          "Learn and practise one reframing technique (e.g., 'what would I advise a friend?')",
          "Develop a personal 'reset routine' for after high-stress situations (3-5 minutes)",
          "Schedule one debrief per week with a trusted colleague after tough conversations",
          "Read one book or course on emotional regulation (e.g., 'Emotional Agility')",
        ],
        success_criteria: "Recovery time after setbacks reduces noticeably. Peers report more composure in stressful meetings.",
        timeline_weeks: 8,
      },
    ],
  },

  // ── EXECUTION ──
  "Planning ability": {
    low: [
      {
        intervention_type: "STRUCTURED_PRACTICE",
        title: "Project planning fundamentals",
        description: "Build planning discipline through templated project initiation and milestone tracking.",
        actions: [
          "Use a written project brief template for every new initiative (scope, milestones, risks, dependencies)",
          "Break every project into phases with explicit deliverables before starting execution",
          "Identify 3 dependencies per project and build buffer time around each",
          "Review one past project that went off-track — write a root-cause analysis of the planning gap",
          "Present your project plan to a peer for feedback before execution begins",
        ],
        success_criteria: "All projects have written plans before execution starts. Project timelines are met within 10% of estimate.",
        timeline_weeks: 6,
      },
    ],
    medium: [
      {
        intervention_type: "LEADERSHIP_PRACTICE",
        title: "Strategic planning and risk management",
        description: "Move from task planning to strategic planning — anticipate risks, manage stakeholders, and build contingencies.",
        actions: [
          "Create a risk register for your biggest current project with probability and impact ratings",
          "Develop contingency plans for your top 3 project risks",
          "Run a pre-mortem session ('what could go wrong?') with your team before the next major initiative",
          "Track plan-vs-actual accuracy over 8 weeks and adjust your estimation method based on patterns",
        ],
        success_criteria: "Proactively identifies and mitigates project risks. Estimation accuracy improves by 20%.",
        timeline_weeks: 10,
      },
    ],
  },
  Prioritisation: {
    low: [
      {
        intervention_type: "FRAMEWORK_ADOPTION",
        title: "Prioritisation frameworks",
        description: "Learn and apply structured prioritisation to replace reactive task management.",
        actions: [
          "Implement an Eisenhower matrix (urgent vs important) for all incoming work for 4 weeks",
          "Start each day by writing your top 3 priorities before opening email",
          "Practice saying 'let me check my priorities' before accepting new commitments",
          "Track interruptions for 1 week — identify which could have been deferred or delegated",
          "Have a weekly priority alignment conversation with your manager",
        ],
        success_criteria: "Strategic work gets protected time daily. Manager confirms improved focus on high-impact work.",
        timeline_weeks: 6,
      },
    ],
  },

  // ── LEADERSHIP ──
  Influence: {
    low: [
      {
        intervention_type: "STAKEHOLDER_PRACTICE",
        title: "Building influence and persuasion",
        description: "Develop the ability to build buy-in, communicate persuasively, and align stakeholders around shared goals.",
        actions: [
          "Map your top 5 stakeholders: their goals, concerns, and preferred communication style",
          "Prepare one 'pre-meeting alignment' conversation per week (align key stakeholder before group meeting)",
          "Practice the 'what + so what + now what' structure in every recommendation or proposal",
          "Seek feedback from 2 peers on how persuasive they find your communication",
          "Study one leader you admire — identify 3 specific influence techniques they use",
        ],
        success_criteria: "Proposals gain buy-in faster. Stakeholders proactively seek your input on decisions.",
        timeline_weeks: 8,
      },
    ],
  },
  "Conflict handling": {
    low: [
      {
        intervention_type: "BEHAVIORAL_CHANGE",
        title: "Constructive conflict skills",
        description: "Build the ability to address disagreements directly, constructively, and without escalating emotion.",
        actions: [
          "Practice the 'describe behaviour, explain impact, request change' model on one small conflict per week",
          "When you feel tension rising, pause and ask a genuine question before responding",
          "Debrief every significant disagreement within 24 hours: what went well, what would you change",
          "Read 'Crucial Conversations' and apply one technique per week for 6 weeks",
          "Ask your manager to observe one difficult conversation and give you feedback",
        ],
        success_criteria: "Conflicts are surfaced and resolved without avoidance or escalation. Team reports improved psychological safety.",
        timeline_weeks: 10,
      },
    ],
  },
  Delegation: {
    low: [
      {
        intervention_type: "LEADERSHIP_PRACTICE",
        title: "Delegation with empowerment",
        description: "Move from task assignment to true delegation — transfer ownership, set guardrails, and build team capability.",
        actions: [
          "Identify 3 tasks you currently do that someone else could own — delegate one per week",
          "For each delegation: clarify the outcome, authority level, checkpoints, and timeline",
          "Resist the urge to redo delegated work — give feedback instead",
          "Check in at agreed checkpoints only — not before, not ad-hoc",
          "Ask the delegate what they learned and what they would do differently",
        ],
        success_criteria: "3+ tasks successfully delegated with no quality loss. Team reports feeling more trusted and capable.",
        timeline_weeks: 8,
      },
    ],
  },

  // ── SJT ──
  "Stakeholder trade-off navigation": {
    low: [
      {
        intervention_type: "JUDGMENT_BUILDING",
        title: "Stakeholder trade-off analysis",
        description: "Build judgment for navigating competing stakeholder demands through structured analysis and scenario practice.",
        actions: [
          "For every multi-stakeholder decision, write a one-page trade-off analysis before deciding",
          "Identify the 'hidden stakeholder' in your next 3 decisions — who is affected but not in the room?",
          "Practice the 'transparent trade-off' conversation: explain what you chose, what you sacrificed, and why",
          "Debrief one past decision that pleased one stakeholder but upset another — what would you do differently?",
        ],
        success_criteria: "Stakeholders feel heard even when decisions don't go their way. Trade-off rationale is clear and defensible.",
        timeline_weeks: 8,
      },
    ],
  },
  "Ethical boundary recognition": {
    low: [
      {
        intervention_type: "AWARENESS_BUILDING",
        title: "Ethical decision-making framework",
        description: "Strengthen the ability to recognise ethical boundaries and act decisively when they are crossed.",
        actions: [
          "Review your company's code of conduct and identify 3 grey areas relevant to your role",
          "For every significant decision, ask: 'Would I be comfortable if this appeared in a news article?'",
          "Discuss one ethical dilemma per month with a trusted mentor or peer",
          "Document one situation where you recognised and acted on an ethical boundary",
        ],
        success_criteria: "Proactively raises ethical concerns before they escalate. Decisions pass the 'newspaper test'.",
        timeline_weeks: 8,
      },
    ],
  },
};

// ── Default fallback for dimensions not in the library ──

function build_default_intervention(dim: GapDimension): InterventionTemplate {
  const is_low = (dim.score_0_100 ?? 0) < 33;
  return {
    intervention_type: is_low ? "FOUNDATIONAL" : "ADVANCEMENT",
    title: `Strengthen ${dim.sub_dimension_name.toLowerCase()}`,
    description: `Targeted development to improve ${dim.sub_dimension_name.toLowerCase()} from current level to role expectations.`,
    actions: [
      `Identify 2-3 specific behaviours linked to ${dim.sub_dimension_name.toLowerCase()} in your daily work`,
      "Set a weekly practice goal and track completion",
      "Ask a peer or manager for specific feedback on this area every 2 weeks",
      "Reflect on progress at the end of each week — journal what improved and what didn't",
      ...(dim.recommendation_texts.length > 0 ? [`Follow the existing recommendation: "${dim.recommendation_texts[0]}"`] : []),
    ],
    success_criteria: `Measurable improvement in ${dim.sub_dimension_name.toLowerCase()} observed by manager and peers within the timeline.`,
    timeline_weeks: is_low ? 8 : 10,
  };
}

// ── Main plan generation function ──

export function generate_development_plan(input: {
  candidate_name: string;
  role_family_name: string;
  gaps: GapDimension[];
  fit_score_pct: number;
  recommendation: string;
}): PlanOutput {
  const sorted_gaps = [...input.gaps]
    .sort((a, b) => {
      if (a.high_stakes_gap !== b.high_stakes_gap) return a.high_stakes_gap ? -1 : 1;
      return (a.score_0_100 ?? 50) - (b.score_0_100 ?? 50);
    })
    .slice(0, 6); // Focus on top 6 gaps

  const interventions: GeneratedIntervention[] = sorted_gaps.map((gap, index) => {
    const score = gap.score_0_100 ?? 50;
    const band = score < 33 ? "low" : "medium";
    const lib = INTERVENTION_LIBRARY[gap.sub_dimension_name]?.[band];
    const template = lib?.[0] ?? build_default_intervention(gap);
    const target = Math.min(100, score + (band === "low" ? 25 : 15));

    return {
      ...template,
      sub_dimension_name: gap.sub_dimension_name,
      gap_score: Math.round(score),
      target_score: Math.round(target),
      priority: index + 1,
    };
  });

  const high_priority = interventions.filter((i) => i.priority <= 3);
  const total_weeks = Math.max(...interventions.map((i) => i.timeline_weeks), 12);

  const plan_summary = build_plan_summary(input, interventions, total_weeks);

  return {
    plan_summary,
    interventions,
    target_review_date_weeks: total_weeks,
  };
}

function build_plan_summary(
  input: { candidate_name: string; role_family_name: string; fit_score_pct: number; recommendation: string },
  interventions: GeneratedIntervention[],
  total_weeks: number,
): string {
  const rec_label =
    input.recommendation === "STRONG_FIT" ? "strong fit" :
    input.recommendation === "FIT" ? "fit" :
    input.recommendation === "DEVELOP" ? "develop" : "poor fit";

  const top_gaps = interventions.slice(0, 3).map((i) => i.sub_dimension_name.toLowerCase()).join(", ");

  return [
    `Development plan for ${input.candidate_name} in the ${input.role_family_name} role family.`,
    `Overall fit score: ${Math.round(input.fit_score_pct)}% (${rec_label}).`,
    ``,
    `This plan targets ${interventions.length} development areas over ${total_weeks} weeks.`,
    `Priority areas: ${top_gaps}.`,
    ``,
    `Each intervention includes specific actions, success criteria, and a timeline.`,
    `Progress should be reviewed by the manager at the midpoint (week ${Math.round(total_weeks / 2)}) and at completion (week ${total_weeks}).`,
    `The plan should be revisited after reassessment to measure actual improvement.`,
  ].join("\n");
}
