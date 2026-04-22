import type { AssessmentLayerCode, ItemReviewStatus, ItemType } from "@prisma/client";

type SeedItemOption = {
  display_order: number;
  is_correct?: boolean;
  option_text: string;
  score_weight?: number;
};

export type SeedItem = {
  correct_answer?: unknown;
  created_by: string;
  desirability_rating?: number;
  difficulty_b?: number;
  discrimination_a?: number;
  guessing_c?: number;
  item_options?: SeedItemOption[];
  item_type: ItemType;
  layer_code: AssessmentLayerCode;
  review_status: ItemReviewStatus;
  scoring_key?: unknown;
  stem: string;
  sub_dimension_name: string;
  tags?: unknown;
  time_limit_seconds?: number | null;
};

type ScoredOption = readonly [string, number];
type ExecutionSelfReportItem = readonly [string, string, boolean];
type ScenarioTemplate = readonly [string, string, readonly ScoredOption[]];
type StatementPair = readonly [string, string];
type MotivatorStatement = readonly [string, string, string];

const likert_options: SeedItemOption[] = [
  { display_order: 1, option_text: "1 - Strongly disagree", score_weight: 1 },
  { display_order: 2, option_text: "2 - Disagree", score_weight: 2 },
  { display_order: 3, option_text: "3 - Neutral", score_weight: 3 },
  { display_order: 4, option_text: "4 - Agree", score_weight: 4 },
  { display_order: 5, option_text: "5 - Strongly agree", score_weight: 5 },
];

const role_family_segments: string[] = [
  "Plant Operations Manager",
  "Key Account Manager",
  "Application / R&D Engineer",
  "Business Unit Leader",
  "Sales / BD",
  "Commercial / KAM",
];

export function build_step_two_question_bank(created_by: string): SeedItem[] {
  return [
    ...build_cognitive_items(created_by),
    ...build_personality_items(created_by),
    ...build_motivator_items(created_by),
    ...build_execution_items(created_by),
    ...build_leadership_items(created_by),
    ...build_sjt_items(created_by),
  ];
}

function build_cognitive_items(created_by: string): SeedItem[] {
  const logical_templates = [
    {
      answer: "Rajesh will receive a bonus.",
      difficulty: -1,
      options: [
        "Rajesh may receive a bonus.",
        "Rajesh will receive a bonus.",
        "Rajesh exceeded his target but is not a manager.",
        "All managers receive bonuses regardless of target.",
      ],
      stem: "All managers who exceed targets receive bonuses. Rajesh is a manager who exceeded his target. Which conclusion follows?",
    },
    {
      answer: "48",
      difficulty: -1,
      options: ["36", "42", "48", "54"],
      stem: "Sequence: 3, 6, 12, 24, __?",
    },
    {
      answer: "Product X is not defective.",
      difficulty: 0,
      options: [
        "Product X is defective.",
        "Product X is not defective.",
        "Product X may be defective.",
        "No conclusion can be drawn.",
      ],
      stem: "No defective products passed QC. Product X passed QC. What follows?",
    },
    {
      answer: "1,360 units",
      difficulty: 0,
      options: ["1,120 units", "1,360 units", "1,520 units", "1,760 units"],
      stem: "Machine A runs at 120 units/hr for 8 hours with 2 hours downtime. Machine B runs at 80 units/hr for 8 hours. What is the total output?",
    },
    {
      answer: "4%",
      difficulty: 1.5,
      options: ["2%", "4%", "6%", "8%"],
      stem: "Three shifts operate a line. Shift A has twice the error rate of Shift B. Shift C equals half of Shift A. If Shift B is 4%, what is Shift C?",
    },
  ];

  const numerical_templates = [
    {
      answer: "30%",
      difficulty: -1,
      options: ["24%", "28%", "30%", "36%"],
      stem: "Revenue grew from Rs 12 Cr to Rs 15.6 Cr. What is the growth rate?",
    },
    {
      answer: "Rs 44L",
      difficulty: -1,
      options: ["Rs 36L", "Rs 44L", "Rs 48L", "Rs 54L"],
      stem: "Raw material cost is 45% of Rs 80L revenue. What is gross margin in rupees?",
    },
    {
      answer: "12,220 units",
      difficulty: 0,
      options: ["11,700", "12,220", "12,480", "13,000"],
      stem: "A plant makes 500 units/day with 6% rejection over a 26-day month. How many good units are produced?",
    },
    {
      answer: "74.2%",
      difficulty: 0,
      options: ["72.6%", "74.2%", "76.5%", "81.7%"],
      stem: "What is OEE if availability is 85%, performance is 90%, and quality is 97%?",
    },
    {
      answer: "48 additional good units",
      difficulty: 1.5,
      options: ["24", "36", "48", "72"],
      stem: "A plant ships 2,400 units/week. Rejects fall from 5% to 3%. How many additional good units ship each week?",
    },
  ];

  const verbal_templates = [
    {
      answer: "Bevel",
      difficulty: -1,
      options: ["Electrode", "Flux", "Bevel", "Ampere"],
      stem: "Which word does NOT belong: Electrode, Flux, Bevel, Ampere?",
    },
    {
      answer: "Clear",
      difficulty: -1,
      options: ["Opaque", "Clear", "Urgent", "Calm"],
      stem: "Exigent : urgent :: pellucid : ?",
    },
    {
      answer: "Efficiency gains may have come at a safety cost.",
      difficulty: 0,
      options: [
        "Safety improved more than efficiency.",
        "Efficiency gains may have come at a safety cost.",
        "OEE and safety have no relationship.",
        "Safety incidents are unrelated to plant changes.",
      ],
      stem: "A plant achieved 94% OEE, up from 88%, but safety incidents also rose 15%. What is the strongest inference?",
    },
    {
      answer: "The memo recommends phased export entry.",
      difficulty: 0,
      options: [
        "The memo recommends a full-market launch immediately.",
        "The memo recommends cancelling export entry.",
        "The memo recommends phased export entry.",
        "The memo recommends no distributor due diligence.",
      ],
      stem: "A strategy note says, 'Begin with a limited trial shipment, validate channel reliability, and scale only after payment discipline is proven.' What does the note recommend?",
    },
    {
      answer: "Escalate with evidence and a proposed path forward.",
      difficulty: 1.5,
      options: [
        "Avoid escalation until quarterly review.",
        "Escalate with evidence and a proposed path forward.",
        "Escalate only if revenue is unaffected.",
        "Escalate without checking the facts.",
      ],
      stem: "Choose the best professional paraphrase of: 'Raise the issue early, with facts, trade-offs, and a concrete next step.'",
    },
  ];

  const abstract_patterns = ["rotation", "element_addition", "shading", "symmetry", "xor_overlay"];

  return [
    ...build_mcq_series(created_by, "Logical reasoning", logical_templates, 15, "COGNITIVE", "logical"),
    ...build_mcq_series(created_by, "Numerical reasoning", numerical_templates, 15, "COGNITIVE", "numerical"),
    ...build_abstract_items(created_by, abstract_patterns),
    ...build_mcq_series(created_by, "Verbal reasoning", verbal_templates, 15, "COGNITIVE", "verbal"),
  ];
}

function build_mcq_series(
  created_by: string,
  sub_dimension_name: string,
  templates: Array<{ answer: string; difficulty: number; options: string[]; stem: string }>,
  count: number,
  layer_code: AssessmentLayerCode,
  tag: string,
): SeedItem[] {
  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    const difficulty_label = index < 5 ? "easy" : index < 10 ? "medium" : "hard";
    const b = difficulty_label === "easy" ? -1 : difficulty_label === "medium" ? 0 : 1.5;

    return {
      correct_answer: { option_text: template.answer },
      created_by,
      difficulty_b: b,
      discrimination_a: 1.05,
      guessing_c: 0.2,
      item_options: template.options.map((option_text, option_index) => ({
        display_order: option_index + 1,
        is_correct: option_text === template.answer,
        option_text,
        score_weight: option_text === template.answer ? 1 : 0,
      })),
      item_type: "MCQ" as const,
      layer_code,
      review_status: "APPROVED" as const,
      scoring_key: { accuracy_weight: 0.7, speed_weight: 0.3, correct_option: template.answer },
      stem: `${template.stem} [Seed ${index + 1}]`,
      sub_dimension_name,
      tags: {
        difficulty: difficulty_label,
        role_family_usage: role_family_segments,
        topic: tag,
      },
      time_limit_seconds: 60,
    };
  });
}

function build_abstract_items(created_by: string, pattern_types: string[]): SeedItem[] {
  return Array.from({ length: 15 }, (_, index) => {
    const pattern_type = pattern_types[index % pattern_types.length];
    const difficulty_label = index < 5 ? "easy" : index < 10 ? "medium" : "hard";
    const difficulty_b = difficulty_label === "easy" ? -1 : difficulty_label === "medium" ? 0 : 1.5;
    const correct_option = `Option ${String.fromCharCode(65 + (index % 4))}`;

    const options = Array.from({ length: 6 }, (_, option_index) => ({
      id: `option-${option_index + 1}`,
      label: `Option ${String.fromCharCode(65 + option_index)}`,
      shape: ["triangle", "square", "circle", "hexagon", "diamond", "arrow"][option_index],
      transform: {
        rotate: ((index + option_index) % 4) * 90,
        shade: option_index % 2 === 0 ? "solid" : "outline",
      },
    }));

    return {
      correct_answer: { option_text: correct_option },
      created_by,
      difficulty_b,
      discrimination_a: 1.1,
      guessing_c: 0.18,
      item_options: options.map((option, option_index) => ({
        display_order: option_index + 1,
        is_correct: option.label === correct_option,
        option_text: option.label,
        score_weight: option.label === correct_option ? 1 : 0,
      })),
      item_type: "MCQ" as const,
      layer_code: "COGNITIVE" as const,
      review_status: "APPROVED" as const,
      scoring_key: {
        accuracy_weight: 0.7,
        correct_option: correct_option,
        renderer: "abstract_matrix",
      },
      stem: `Select the option that correctly completes the 3x3 visual matrix. Pattern rule: ${pattern_type}. [Seed ${index + 1}]`,
      sub_dimension_name: "Abstract pattern recognition",
      tags: {
        difficulty: difficulty_label,
        renderer: "abstract_matrix",
        role_family_usage: role_family_segments,
      },
      time_limit_seconds: 75,
    } satisfies SeedItem & { tags: unknown; scoring_key: unknown } as SeedItem;
  }).map((item, index) => ({
    ...item,
    tags: {
      ...(item.tags as Record<string, unknown>),
      pattern_definition: {
        columns: 3,
        rows: 3,
        rule: pattern_types[index % pattern_types.length],
      },
      options: Array.from({ length: 6 }, (_, option_index) => ({
        id: `option-${option_index + 1}`,
        label: `Option ${String.fromCharCode(65 + option_index)}`,
      })),
    },
  }));
}

function build_personality_items(created_by: string): SeedItem[] {
  const trait_statements = {
    Agreeableness: [
      "I prioritise maintaining harmony in working relationships.",
      "I look for ways to support colleagues even when it is not formally required.",
      "I usually consider the human impact of a decision before acting.",
      "I would rather build agreement than win an argument quickly.",
      "I often step in to help a teammate succeed.",
    ],
    "Bias for Action": [
      "I act quickly when I see something that needs to be done.",
      "I can begin executing on a vague brief without waiting for perfect clarity.",
      "I am comfortable turning ambiguity into a first move.",
      "I prefer momentum over prolonged debate when the direction is broadly clear.",
      "I will test a workable solution before polishing it endlessly.",
    ],
    Conscientiousness: [
      "I follow a disciplined routine and rarely miss deadlines.",
      "I carefully review details before making a commitment.",
      "I reliably close what I start.",
      "I prefer clear plans and explicit ownership.",
      "I usually prepare before taking action.",
    ],
    "Emotional Stability": [
      "I stay calm under pressure and rarely feel anxious.",
      "I can absorb setbacks without becoming visibly unsettled.",
      "I tend to remain composed during conflict.",
      "I recover quickly after a difficult conversation.",
      "I can separate pressure from panic.",
    ],
    Extraversion: [
      "I feel energised after working with a large group of people.",
      "I enjoy meeting new people and being in social settings.",
      "I am comfortable taking the lead in a room.",
      "I naturally speak up when a group needs direction.",
      "I build rapport quickly in unfamiliar settings.",
    ],
    Openness: [
      "I like exploring unconventional approaches to problems.",
      "I adapt easily when plans change unexpectedly.",
      "I seek out novel experiences and unfamiliar environments.",
      "I enjoy testing a new approach even when the old one still works.",
      "I prefer learning through experimentation.",
    ],
    "Risk Appetite": [
      "I take calculated risks when I see an opportunity.",
      "I would rather take a bold gamble than accept a safe mediocre outcome.",
      "I am comfortable backing an informed but uncertain decision.",
      "I can tolerate downside risk when the upside matters strategically.",
      "I prefer stretching for a bigger outcome over settling too early.",
    ],
  } as const;

  const trait_names = Object.keys(trait_statements);
  const triads: SeedItem[] = [];

  for (let index = 0; index < 50; index += 1) {
    const first = trait_names[index % trait_names.length] as keyof typeof trait_statements;
    const second = trait_names[(index + 2) % trait_names.length] as keyof typeof trait_statements;
    const third = trait_names[(index + 4) % trait_names.length] as keyof typeof trait_statements;
    const traits = Array.from(new Set([first, second, third]));

    if (traits.length < 3) {
      continue;
    }

    // Desirability varies by trait — calibrated for manufacturing context
    const trait_desirability: Record<string, number> = {
      Conscientiousness: 4.5, Openness: 3.5, "Emotional Stability": 4.2,
      Extraversion: 3.3, Agreeableness: 3.8, "Risk Appetite": 3.0, "Bias for Action": 4.0,
    };
    const statements = traits.map((trait, statement_index) => ({
      desirability_rating: trait_desirability[trait] ?? 3.5,
      statement: trait_statements[trait][Math.floor((index + statement_index) / 2) % trait_statements[trait].length],
      trait,
    }));

    // Triad-level desirability = average of its statements (for matching quality tracking)
    const avg_desirability = Math.round((statements.reduce((s, st) => s + st.desirability_rating, 0) / statements.length) * 10) / 10;

    triads.push({
      created_by,
      desirability_rating: avg_desirability,
      item_type: "FORCED_CHOICE_TRIAD",
      layer_code: "PERSONALITY",
      review_status: "APPROVED",
      scoring_key: {
        least_weight: -1,
        most_weight: 1,
        statements: statements.map((statement, statement_index) => ({
          option_id: `statement-${statement_index + 1}`,
          trait: statement.trait,
        })),
      },
      stem: "Rank the following statements by dragging one into Most Like Me and one into Least Like Me.",
      sub_dimension_name: String(traits[0]),
      tags: {
        desirability_band: String(avg_desirability),
        desirability_spread: Math.round((Math.max(...statements.map((s) => s.desirability_rating)) - Math.min(...statements.map((s) => s.desirability_rating))) * 10) / 10,
        role_family_usage: role_family_segments,
        traits: traits,
      },
      time_limit_seconds: 75,
      item_options: statements.map((statement, statement_index) => ({
        display_order: statement_index + 1,
        option_text: statement.statement,
        score_weight: 0,
      })),
    });
  }

  return triads;
}

function build_motivator_items(created_by: string): SeedItem[] {
  const statements: readonly MotivatorStatement[] = [
    ["Financial vs Mastery vs Purpose", "I am motivated most by financial rewards and wealth accumulation.", "Financial"],
    ["Financial vs Mastery vs Purpose", "I want to become the best in my technical domain.", "Mastery"],
    ["Financial vs Mastery vs Purpose", "I want my work to have a meaningful impact on people’s lives.", "Purpose"],
    ["Stability vs Growth", "I value job security and predictable career progression.", "Stability"],
    ["Stability vs Growth", "I am excited by rapid learning and new challenges.", "Growth"],
    ["Autonomy vs Structure", "I perform best when I have freedom to choose how I work.", "Autonomy"],
    ["Autonomy vs Structure", "I thrive in environments with clear processes and defined roles.", "Structure"],
    ["Power vs Collaboration", "I want to have influence and authority over decisions.", "Power"],
    ["Power vs Collaboration", "I prefer collaborative environments where decisions are shared.", "Collaboration"],
    ["Financial vs Mastery vs Purpose", "I am driven by recognition from peers and industry.", "Recognition"],
    ["Stability vs Growth", "I prioritise work-life balance over rapid career advancement.", "Balance"],
    ["Financial vs Mastery vs Purpose", "I want to build something that outlasts my tenure.", "Legacy"],
    ["Financial vs Mastery vs Purpose", "I am motivated by competitive environments where performance is ranked.", "Competition"],
    ["Power vs Collaboration", "I value transparency and ethical conduct above all else.", "Integrity"],
    ["Power vs Collaboration", "I prefer environments where I can mentor and develop others.", "Nurturing"],
    ["Autonomy vs Structure", "I like goals to be clear but methods to be flexible.", "Guided Autonomy"],
    ["Stability vs Growth", "I am energised when new responsibilities stretch my capacity.", "Stretch"],
    ["Power vs Collaboration", "I enjoy coordinating people around a shared objective.", "Shared Leadership"],
    ["Financial vs Mastery vs Purpose", "I care deeply about mastery even when it is not immediately rewarded.", "Deep Mastery"],
    ["Autonomy vs Structure", "I prefer high ownership over tightly prescribed routines.", "Ownership"],
  ] as const;

  return statements.map(([sub_dimension_name, stem, archetype]) => ({
    created_by,
    item_type: "Q_SORT" as const,
    layer_code: "MOTIVATORS" as const,
    review_status: "APPROVED" as const,
    scoring_key: {
      archetype_cluster_hint: archetype,
      distribution: ["Most Important", "Important", "Somewhat Important", "Least Important"],
    },
    stem,
    sub_dimension_name,
    tags: {
      archetype,
      role_family_usage: role_family_segments,
    },
    time_limit_seconds: null,
  }));
}

function build_execution_items(created_by: string): SeedItem[] {
  const self_report_items: readonly ExecutionSelfReportItem[] = [
    ["Planning ability", "I create a written plan before starting any significant task.", false],
    ["Closure rate", "I regularly complete tasks ahead of deadline.", false],
    ["Process discipline", "I follow established SOPs even when shortcuts are tempting.", false],
    ["Attention to detail", "I review my work for errors before considering it complete.", false],
    ["Prioritisation", "When multiple tasks compete for my time, I prioritise based on impact.", false],
    ["Process discipline", "I maintain organised records and documentation.", false],
    ["Planning ability", "I break large projects into smaller milestones with dates.", false],
    ["Closure rate", "I rarely leave tasks incomplete or almost done.", false],
    ["Planning ability", "I usually create structure for ambiguous work before I start executing.", false],
    ["Process discipline", "I track commitments in a system rather than relying on memory.", false],
    ["Closure rate", "I often move to the next task before properly closing the first one.", true],
    ["Prioritisation", "When several requests arrive at once, I explicitly rank them before acting.", false],
    ["Attention to detail", "I usually notice inconsistencies before others call them out.", false],
    ["Planning ability", "I document assumptions before a major project begins.", false],
    ["Prioritisation", "I know which task I would drop first when capacity is constrained.", false],
    ["Closure rate", "I complete close-out actions, not just the visible deliverable.", false],
    ["Process discipline", "I keep evidence trails for key operational decisions.", false],
    ["Attention to detail", "I double-check calculations and references before sending them onward.", false],
    ["Planning ability", "I define success criteria before assigning work to others.", false],
    ["Prioritisation", "I can separate urgent noise from strategic work.", false],
    ["Closure rate", "I create end-of-day reviews to make sure important work has actually closed.", false],
    ["Attention to detail", "I catch formatting, quantity, or code mismatches before they become defects.", false],
    ["Process discipline", "I escalate process breaks instead of working around them silently.", false],
    ["Prioritisation", "I explain why one task should take precedence over another.", false],
    ["Planning ability", "I identify dependencies before promising timelines.", false],
    ["Attention to detail", "I compare source data to summary data before sharing reports.", false],
    ["Closure rate", "I confirm that recipients have what they need before marking work complete.", false],
    ["Process discipline", "I prefer repeatable systems over heroic last-minute fixes.", false],
    ["Prioritisation", "I reserve time for work that prevents future firefighting.", false],
    ["Planning ability", "I prepare a fallback plan when a task depends on external approvals.", false],
  ];

  const scenario_items: readonly ScenarioTemplate[] = [
    [
      "Prioritisation",
      "You are a production supervisor. Three orders are due this week: Order A high margin due Friday, Order B standard margin due Wednesday with materials ready, Order C low margin due Thursday but the required machine is under maintenance. Team capacity allows two orders at once.",
      [
        ["Start A and B immediately. Defer C until the machine is back.", 4],
        ["Start B and C. C needs lead time.", 2],
        ["Start A and C because A has the highest margin.", 1],
        ["Ask your manager to decide.", 0],
      ],
    ],
    [
      "Process discipline",
      "A major cement customer complains about a defective batch that already shipped. Internal QC records show the batch passed all checks.",
      [
        ["Call the customer, acknowledge the issue, arrange replacement, and investigate immediately.", 4],
        ["Investigate internally before contacting the customer.", 2],
        ["Inform your manager and wait for instructions.", 1],
        ["Tell the customer the batch passed QC and ask them to retest.", 0],
      ],
    ],
    [
      "Attention to detail",
      "Your weekly report template is missing three data points repeatedly requested in Monday reviews. After four weeks you notice the pattern.",
      [
        ["Add the data points and recommend a template update.", 4],
        ["Add them manually but leave the template unchanged.", 2],
        ["Continue with the template because it is not your job to change it.", 0],
        ["Stop using the template and create a private format.", 1],
      ],
    ],
    [
      "Planning ability",
      "A dispatch-critical export order depends on one vendor delivery that has been slipping by 24 hours every week.",
      [
        ["Create a fallback sourcing plan and update the timeline risk now.", 4],
        ["Wait one more cycle before changing the plan.", 2],
        ["Assume the vendor will improve because the issue was already discussed.", 1],
        ["Escalate only after the order misses dispatch.", 0],
      ],
    ],
    [
      "Closure rate",
      "An ERP clean-up task is 90% complete, but the last 10% is tedious and no one is chasing it.",
      [
        ["Finish the close-out and document what changed before moving on.", 4],
        ["Declare it done because the hardest part is complete.", 1],
        ["Move to the next urgent issue and return if someone complains.", 0],
        ["Ask another team to close the loop without a handover.", 0],
      ],
    ],
  ];

  return [
    ...self_report_items.map(([sub_dimension_name, stem, reverse_scored]) => ({
      created_by,
      item_options: likert_options,
      item_type: "LIKERT" as const,
      layer_code: "EXECUTION" as const,
      review_status: "APPROVED" as const,
      scoring_key: { reverse_scored },
      stem,
      sub_dimension_name,
      tags: {
        audience: "CANDIDATE",
        reverse_scored,
        role_family_usage: role_family_segments,
      },
      time_limit_seconds: 45,
    })),
    ...Array.from({ length: 15 }, (_, index) => {
      const [sub_dimension_name, stem, options] = scenario_items[index % scenario_items.length];
      return {
        created_by,
        item_options: options.map(([option_text, score_weight], option_index) => ({
          display_order: option_index + 1,
          option_text,
          score_weight,
        })),
        item_type: "SCENARIO" as const,
        layer_code: "EXECUTION" as const,
        review_status: "APPROVED" as const,
        scoring_key: {
          model: "partial_credit_0_4",
          role_context: "industrial_operations",
        },
        stem: `${stem} [Variant ${index + 1}]`,
        sub_dimension_name,
        tags: {
          audience: "CANDIDATE",
          role_family_usage: role_family_segments,
          scenario_context: ["plant", "dispatch", "quality", "ERP", "customer complaint"][index % 5],
        },
        time_limit_seconds: 90,
      };
    }),
  ];
}

function build_leadership_items(created_by: string): SeedItem[] {
  const self_sjt_templates: readonly ScenarioTemplate[] = [
    [
      "Conflict handling",
      "A direct report repeatedly misses deadlines but is technically excellent. Team morale is starting to drop.",
      [
        ["Have a private conversation, agree an improvement plan, and set follow-up checkpoints.", 4],
        ["Reassign the work without discussing the pattern.", 1],
        ["Issue a formal warning immediately.", 2],
        ["Discuss the issue in the team meeting.", 0],
      ],
    ],
    [
      "Conflict handling",
      "Two team members from different business units have deep personal conflict that is derailing a project.",
      [
        ["Hold individual conversations first, then facilitate structured mediation.", 4],
        ["Escalate straight to the BU heads.", 1],
        ["Reorganise workstreams without addressing the conflict.", 2],
        ["Address it publicly and hope the pressure resolves it.", 0],
      ],
    ],
    [
      "Feedback receptivity",
      "A high performer repeatedly misses cross-functional handoffs and causes rework.",
      [
        ["Address the pattern directly with examples and set new expectations.", 4],
        ["Ignore it because their individual numbers are strong.", 0],
        ["Reassign the work silently.", 1],
        ["Escalate to HR immediately.", 2],
      ],
    ],
    [
      "Delegation",
      "Your team keeps waiting for you to make every decision on a recurring process issue.",
      [
        ["Delegate the outcome, guardrails, and review checkpoints to the team lead.", 4],
        ["Keep deciding everything to protect quality.", 0],
        ["Assign tasks but retain every final call yourself.", 1],
        ["Tell the team to figure it out without parameters.", 1],
      ],
    ],
    [
      "Influence",
      "A cross-functional initiative is stalling because each function sees only its own cost.",
      [
        ["Reframe the issue around total business impact and align stakeholders individually before the next forum.", 4],
        ["Wait for the formal steering committee.", 1],
        ["Push your function’s view harder in the main meeting.", 1],
        ["Drop the initiative until conditions improve.", 0],
      ],
    ],
  ];

  const rater_items: readonly StatementPair[] = [
    ["Influence", "This person communicates a clear direction that motivates the team."],
    ["Influence", "This person adapts their communication style to the audience."],
    ["Influence", "This person brings functions together around shared priorities."],
    ["Influence", "This person creates buy-in before implementation starts."],
    ["Influence", "This person helps others see the business consequence of delay."],
    ["Conflict handling", "This person handles disagreements constructively."],
    ["Conflict handling", "This person creates psychological safety so people raise concerns early."],
    ["Conflict handling", "This person addresses issues directly without escalating emotion."],
    ["Conflict handling", "This person resolves tension around facts and trade-offs."],
    ["Conflict handling", "This person does not let unresolved friction slow delivery for long."],
    ["Feedback receptivity", "This person actively seeks feedback and acts on it."],
    ["Feedback receptivity", "This person makes it easy to challenge their assumptions."],
    ["Feedback receptivity", "This person visibly changes behaviour when feedback is valid."],
    ["Feedback receptivity", "This person thanks people for specific developmental feedback."],
    ["Feedback receptivity", "This person does not become defensive under challenge."],
    ["Delegation", "This person delegates effectively and gives authority, not just tasks."],
    ["Delegation", "This person develops team capability through ownership."],
    ["Delegation", "This person sets clear guardrails when handing off work."],
    ["Delegation", "This person checks quality at the right control points."],
    ["Delegation", "This person avoids becoming the bottleneck for routine decisions."],
    ["Team energy", "This person raises the energy and engagement of the team."],
    ["Team energy", "This person keeps morale steady during pressure periods."],
    ["Team energy", "This person recognises effort in a way that builds momentum."],
    ["Team energy", "This person brings optimism without hiding risks."],
    ["Team energy", "This person helps the team recover quickly after setbacks."],
  ];

  return [
    ...Array.from({ length: 20 }, (_, index) => {
      const [sub_dimension_name, stem, options] = self_sjt_templates[index % self_sjt_templates.length];
      return {
        created_by,
        item_options: options.map(([option_text, score_weight], option_index) => ({
          display_order: option_index + 1,
          option_text,
          score_weight,
        })),
        item_type: "SCENARIO" as const,
        layer_code: "LEADERSHIP" as const,
        review_status: "APPROVED" as const,
        scoring_key: { audience: "SELF", model: "partial_credit_0_4" },
        stem: `${stem} [Leadership self-SJT ${index + 1}]`,
        sub_dimension_name,
        tags: {
          audience: "SELF",
          role_family_usage: role_family_segments,
        },
        time_limit_seconds: 90,
      };
    }),
    ...rater_items.map(([sub_dimension_name, stem]) => ({
      created_by,
      item_options: likert_options,
      item_type: "LIKERT" as const,
      layer_code: "LEADERSHIP" as const,
      review_status: "APPROVED" as const,
      scoring_key: { audience: "RATER" },
      stem,
      sub_dimension_name,
      tags: {
        audience: "RATER",
        role_family_usage: role_family_segments,
      },
      time_limit_seconds: 45,
    })),
  ];
}

function build_sjt_items(created_by: string): SeedItem[] {
  const scenario_bank: readonly ScenarioTemplate[] = [
    [
      "Stakeholder trade-off navigation",
      "You are a plant manager at a welding consumables factory. A major steel customer needs an urgent order in 5 days instead of the normal 10. Accepting means a weekend shift and delaying a smaller customer by 3 days.",
      [
        ["Accept, run the weekend shift, and call the smaller customer with an explanation and mitigation plan.", 4],
        ["Accept and pull people from QC to run both jobs.", 1],
        ["Decline outright because quality cannot be compromised.", 2],
        ["Accept and quietly delay the smaller customer.", 0],
        ["Counter-propose a partial shipment in 5 days and balance the remainder in 10.", 3],
      ],
    ],
    [
      "Escalation judgment",
      "A senior sales manager has been offering unauthorised discounts above the approved threshold for six months and remains a top revenue generator.",
      [
        ["Review the deals, meet privately, enforce policy, and implement deal-desk approval.", 4],
        ["Fire the manager immediately.", 0],
        ["Let it slide because revenue is strong.", 0],
        ["Raise the approved limit to match current behaviour.", 1],
        ["Escalate to the board without first checking the facts.", 2],
      ],
    ],
    [
      "Resource constraint decisions",
      "A new East Africa export market shows strong demand but net-90 terms, unclear regulation, and an unverified distributor.",
      [
        ["Enter in phases with a small advance-payment trial, verify the distributor, and scale carefully.", 4],
        ["Commit the full entry budget immediately for first-mover advantage.", 0],
        ["Decline because there are too many unknowns.", 1],
        ["Commission a long market study before taking any action.", 2],
        ["Partner with an exporter already operating in the region.", 3],
      ],
    ],
    [
      "Ethical boundary recognition",
      "A routine plant audit finds that a grinding machine safety guard was removed to raise throughput by 15%. No incidents have happened yet.",
      [
        ["Reinstate the guard, suspend the supervisor, and review incentive design.", 4],
        ["Reinstate the guard but take no further action.", 1],
        ["Document it for the next quarterly review.", 0],
        ["Keep the guard off and increase supervision.", 0],
      ],
    ],
    [
      "Problem framing",
      "Two major customer orders compete for limited capacity. One is strategically important; the other carries delay penalties.",
      [
        ["Prioritise the loudest escalation.", 0],
        ["Pause both until senior management decides.", 1],
        ["Review commercial impact, strategic value, and recovery options, then communicate a transparent plan.", 4],
        ["Split capacity 50/50 regardless of economics.", 1],
      ],
    ],
  ];

  return Array.from({ length: 25 }, (_, index) => {
    const [sub_dimension_name, stem, options] = scenario_bank[index % scenario_bank.length];
    const role_family_usage = index % 2 === 0 ? role_family_segments : role_family_segments.slice(0, 3);

    return {
      created_by,
      item_options: options.map(([option_text, score_weight], option_index) => ({
        display_order: option_index + 1,
        option_text,
        score_weight,
      })),
      item_type: "SCENARIO" as const,
      layer_code: "SJT" as const,
      review_status: "APPROVED" as const,
      scoring_key: { model: "partial_credit_0_4", rationale_required: true },
      stem: `${stem} [SJT ${index + 1}]`,
      sub_dimension_name,
      tags: {
        role_family_usage,
        scenario_family: sub_dimension_name,
      },
      time_limit_seconds: 120,
    };
  });
}
