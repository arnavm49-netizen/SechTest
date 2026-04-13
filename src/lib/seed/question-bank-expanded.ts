/**
 * Expanded question bank — adds items so every ItemType has at least 100 items.
 *
 * Current counts from build_step_two_question_bank:
 *   MCQ                  ~60
 *   FORCED_CHOICE_TRIAD  ~50
 *   Q_SORT               ~20
 *   LIKERT               ~55
 *   SCENARIO             ~60
 *   RANKING               0
 *   FORCED_CHOICE_PAIR    0
 *   SINGLE_CHOICE_TIMED   0
 *   SIMULATION            0
 *
 * This file fills the gaps to bring each type to >= 100 and adds 100 of each new type.
 */

import type { SeedItem } from "./question-bank";

const role_family_segments: string[] = [
  "Plant Operations Manager",
  "Key Account Manager",
  "Application / R&D Engineer",
  "Business Unit Leader",
  "Sales / BD",
  "Commercial / KAM",
];

const likert_options = [
  { display_order: 1, option_text: "1 - Strongly disagree", score_weight: 1 },
  { display_order: 2, option_text: "2 - Disagree", score_weight: 2 },
  { display_order: 3, option_text: "3 - Neutral", score_weight: 3 },
  { display_order: 4, option_text: "4 - Agree", score_weight: 4 },
  { display_order: 5, option_text: "5 - Strongly agree", score_weight: 5 },
];

// ─── MCQ extras (40 more → total ~100) ────────────────────────────────────────

function build_extra_mcq(created_by: string): SeedItem[] {
  const templates: Array<{
    answer: string;
    difficulty: number;
    options: string[];
    stem: string;
    sub: string;
  }> = [
    // Logical reasoning
    { sub: "Logical reasoning", stem: "If all engineers attend safety training, and Priya is an engineer, what must be true?", options: ["Priya may attend training.", "Priya attends safety training.", "Only some engineers attend.", "Safety training is optional."], answer: "Priya attends safety training.", difficulty: -1 },
    { sub: "Logical reasoning", stem: "Sequence: 2, 6, 18, 54, __?", options: ["108", "162", "216", "324"], answer: "162", difficulty: 0 },
    { sub: "Logical reasoning", stem: "No items that fail inspection reach customers. Item Z reached a customer. What follows?", options: ["Item Z failed inspection.", "Item Z passed inspection.", "Item Z was not inspected.", "No conclusion."], answer: "Item Z passed inspection.", difficulty: 0 },
    { sub: "Logical reasoning", stem: "If the project is late, funding is reduced. Funding was not reduced. What follows?", options: ["The project is late.", "The project is not late.", "Funding is irrelevant.", "No conclusion."], answer: "The project is not late.", difficulty: 1.5 },
    { sub: "Logical reasoning", stem: "All critical suppliers must be audited annually. Supplier X was not audited. What follows?", options: ["Supplier X is critical.", "Supplier X is not critical.", "Supplier X was compliant.", "Auditing is optional."], answer: "Supplier X is not critical.", difficulty: 0 },

    // Numerical reasoning
    { sub: "Numerical reasoning", stem: "A team processes 150 units/hr. After a 20% improvement, how many units per 8-hour shift?", options: ["1,200", "1,320", "1,440", "1,500"], answer: "1,440", difficulty: 0 },
    { sub: "Numerical reasoning", stem: "Monthly cost fell from Rs 24L to Rs 18L. What is the percentage decrease?", options: ["20%", "25%", "30%", "33%"], answer: "25%", difficulty: -1 },
    { sub: "Numerical reasoning", stem: "A plant has 3 lines at 90%, 85%, and 95% uptime. What is the average uptime?", options: ["88%", "89%", "90%", "91%"], answer: "90%", difficulty: -1 },
    { sub: "Numerical reasoning", stem: "If scrap rate is 8% on 5,000 units, how many good units remain?", options: ["4,400", "4,500", "4,600", "4,700"], answer: "4,600", difficulty: 0 },
    { sub: "Numerical reasoning", stem: "Revenue is Rs 50 Cr with 12% net margin. What is the net profit?", options: ["Rs 5 Cr", "Rs 6 Cr", "Rs 7 Cr", "Rs 8 Cr"], answer: "Rs 6 Cr", difficulty: -1 },

    // Verbal reasoning
    { sub: "Verbal reasoning", stem: "Choose the word most similar to 'meticulous':", options: ["Careless", "Thorough", "Quick", "Ambitious"], answer: "Thorough", difficulty: -1 },
    { sub: "Verbal reasoning", stem: "'Brevity is the soul of wit' — what does this convey?", options: ["Long explanations are best.", "Concise communication is powerful.", "Humour is unnecessary.", "Talent is innate."], answer: "Concise communication is powerful.", difficulty: 0 },
    { sub: "Verbal reasoning", stem: "Choose the word that does NOT belong: Electrode, Capacitor, Resistor, Catalyst.", options: ["Electrode", "Capacitor", "Resistor", "Catalyst"], answer: "Catalyst", difficulty: 0 },
    { sub: "Verbal reasoning", stem: "Synonym for 'pragmatic':", options: ["Idealistic", "Theoretical", "Practical", "Abstract"], answer: "Practical", difficulty: -1 },
    { sub: "Verbal reasoning", stem: "A memo states: 'We must prioritise retention over recruitment this quarter.' The memo implies:", options: ["Recruitment is banned.", "Keeping existing staff is more important right now.", "Retention is always more important.", "No hiring is possible."], answer: "Keeping existing staff is more important right now.", difficulty: 0 },

    // Abstract pattern recognition
    { sub: "Abstract pattern recognition", stem: "Select the option that completes the visual pattern. Rule: colour alternation. [Expanded 1]", options: ["Option A", "Option B", "Option C", "Option D"], answer: "Option B", difficulty: -1 },
    { sub: "Abstract pattern recognition", stem: "Select the option that completes the visual pattern. Rule: size progression. [Expanded 2]", options: ["Option A", "Option B", "Option C", "Option D"], answer: "Option C", difficulty: 0 },
    { sub: "Abstract pattern recognition", stem: "Select the option that completes the visual pattern. Rule: mirror reflection. [Expanded 3]", options: ["Option A", "Option B", "Option C", "Option D"], answer: "Option A", difficulty: 0 },
    { sub: "Abstract pattern recognition", stem: "Select the option that completes the visual pattern. Rule: rotation 90°. [Expanded 4]", options: ["Option A", "Option B", "Option C", "Option D"], answer: "Option D", difficulty: 1.5 },
    { sub: "Abstract pattern recognition", stem: "Select the option that completes the visual pattern. Rule: element subtraction. [Expanded 5]", options: ["Option A", "Option B", "Option C", "Option D"], answer: "Option B", difficulty: 1.5 },
  ];

  return Array.from({ length: 40 }, (_, i) => {
    const t = templates[i % templates.length];
    const diff_label = i < 14 ? "easy" : i < 28 ? "medium" : "hard";
    const b = diff_label === "easy" ? -1 : diff_label === "medium" ? 0 : 1.5;
    return {
      correct_answer: { option_text: t.answer },
      created_by,
      difficulty_b: b,
      discrimination_a: 1.05,
      guessing_c: 0.2,
      item_options: t.options.map((opt, oi) => ({
        display_order: oi + 1,
        is_correct: opt === t.answer,
        option_text: opt,
        score_weight: opt === t.answer ? 1 : 0,
      })),
      item_type: "MCQ" as const,
      layer_code: "COGNITIVE" as const,
      review_status: "APPROVED" as const,
      scoring_key: { accuracy_weight: 0.7, speed_weight: 0.3, correct_option: t.answer },
      stem: `${t.stem} [Exp ${i + 1}]`,
      sub_dimension_name: t.sub,
      tags: { difficulty: diff_label, role_family_usage: role_family_segments },
      time_limit_seconds: 60,
    };
  });
}

// ─── FORCED_CHOICE_TRIAD extras (50 more → total ~100) ───────────────────────

function build_extra_triads(created_by: string): SeedItem[] {
  const trait_statements: Record<string, string[]> = {
    Conscientiousness: [
      "I organise my workspace before starting each day.",
      "I keep detailed records of my commitments.",
      "I set personal deadlines tighter than official ones.",
      "I rarely leave work without checking my to-do list.",
      "I prefer finishing one task before starting another.",
      "I proofread emails before sending them.",
      "I maintain a daily work journal.",
      "I track progress against milestones weekly.",
    ],
    Openness: [
      "I look forward to learning new software tools.",
      "I enjoy cross-functional rotations.",
      "I read outside my domain to find fresh ideas.",
      "I am energised by unfamiliar problems.",
      "I like working on projects where the answer is unknown.",
      "I volunteer for pilot programmes.",
      "I ask questions that challenge standard thinking.",
      "I seek feedback from people outside my team.",
    ],
    "Emotional Stability": [
      "I sleep well even when work is intense.",
      "I separate a tough conversation from my personal feelings.",
      "I maintain my routine under deadline pressure.",
      "I do not dwell on criticism after processing it.",
      "I manage frustration without letting it affect my team.",
      "I keep perspective when small things go wrong.",
      "I stay balanced even when outcomes are uncertain.",
      "I return to baseline quickly after a stressful week.",
    ],
    Extraversion: [
      "I volunteer to present in large meetings.",
      "I enjoy networking events and industry conferences.",
      "I seek collaborative work over solitary tasks.",
      "I initiate conversations with new colleagues.",
      "I like coordinating social events for my team.",
      "I am energised by brainstorming sessions.",
      "I naturally check in on teammates throughout the day.",
      "I prefer open-plan offices to private rooms.",
    ],
    Agreeableness: [
      "I avoid harsh language even when frustrated.",
      "I try to understand others' perspectives before disagreeing.",
      "I actively build trust with new colleagues.",
      "I offer help without being asked.",
      "I adjust my communication to the listener's needs.",
      "I look for middle ground in disagreements.",
      "I celebrate others' achievements publicly.",
      "I accept compromise when it keeps the team moving.",
    ],
    "Risk Appetite": [
      "I would pitch a bold idea even in a conservative meeting.",
      "I prefer high-stakes assignments over routine ones.",
      "I accept temporary failure as part of learning.",
      "I invest time in unproven approaches if the upside is large.",
      "I challenge overly cautious planning.",
      "I am comfortable with ambiguous data when making decisions.",
      "I pursue opportunities others think are too risky.",
      "I act decisively when the window is narrow.",
    ],
    "Bias for Action": [
      "I send a first draft rather than waiting for perfection.",
      "I prototype rapidly to test concepts.",
      "I move forward with 80% information rather than waiting for 100%.",
      "I create urgency around slow-moving initiatives.",
      "I set self-imposed deadlines to maintain momentum.",
      "I prefer shipping quickly and iterating.",
      "I remove blockers for my team instead of escalating.",
      "I rarely wait for someone to tell me the next step.",
    ],
  };

  const trait_names = Object.keys(trait_statements);
  const items: SeedItem[] = [];

  for (let i = 0; i < 50; i++) {
    const a = trait_names[i % trait_names.length];
    const b = trait_names[(i + 3) % trait_names.length];
    const c = trait_names[(i + 5) % trait_names.length];
    const traits = Array.from(new Set([a, b, c]));
    if (traits.length < 3) continue;

    const stmts = traits.map((t, si) => ({
      desirability_rating: 4,
      statement: trait_statements[t][(i + si) % trait_statements[t].length],
      trait: t,
    }));

    items.push({
      created_by,
      desirability_rating: 4,
      item_type: "FORCED_CHOICE_TRIAD",
      layer_code: "PERSONALITY",
      review_status: "APPROVED",
      scoring_key: {
        least_weight: -1,
        most_weight: 1,
        statements: stmts.map((s, si) => ({ option_id: `statement-${si + 1}`, trait: s.trait })),
      },
      stem: "Rank the following statements by dragging one into Most Like Me and one into Least Like Me.",
      sub_dimension_name: String(traits[0]),
      tags: { desirability_band: "4", role_family_usage: role_family_segments, traits },
      time_limit_seconds: 75,
      item_options: stmts.map((s, si) => ({
        display_order: si + 1,
        option_text: s.statement,
        score_weight: 0,
      })),
    });
  }

  return items;
}

// ─── Q_SORT extras (80 more → total ~100) ────────────────────────────────────

function build_extra_qsort(created_by: string): SeedItem[] {
  const statements: Array<[string, string, string]> = [
    ["Financial vs Mastery vs Purpose", "I want to earn enough to feel financially independent.", "Financial"],
    ["Financial vs Mastery vs Purpose", "I value learning a craft deeply over broad exposure.", "Mastery"],
    ["Financial vs Mastery vs Purpose", "I care about the social impact of my employer.", "Purpose"],
    ["Financial vs Mastery vs Purpose", "I am motivated by bonuses tied to team performance.", "Financial"],
    ["Financial vs Mastery vs Purpose", "I seek roles that let me publish or present my work.", "Mastery"],
    ["Financial vs Mastery vs Purpose", "I want my work to contribute to sustainability.", "Purpose"],
    ["Financial vs Mastery vs Purpose", "I compare my compensation to market benchmarks regularly.", "Financial"],
    ["Financial vs Mastery vs Purpose", "I invest personal time in professional certifications.", "Mastery"],
    ["Financial vs Mastery vs Purpose", "I would take a pay cut for a mission-driven organisation.", "Purpose"],
    ["Financial vs Mastery vs Purpose", "I negotiate aggressively for compensation increases.", "Financial"],
    ["Stability vs Growth", "I prefer a predictable schedule over spontaneous assignments.", "Stability"],
    ["Stability vs Growth", "I actively seek stretch assignments outside my comfort zone.", "Growth"],
    ["Stability vs Growth", "I value long tenure at one company.", "Stability"],
    ["Stability vs Growth", "I seek rapid promotion even if it means more pressure.", "Growth"],
    ["Stability vs Growth", "I prefer incremental improvement over radical change.", "Stability"],
    ["Stability vs Growth", "I look for roles that expand my skill set quickly.", "Growth"],
    ["Stability vs Growth", "I value pension and retirement benefits.", "Stability"],
    ["Stability vs Growth", "I am excited by new industries and unknown markets.", "Growth"],
    ["Stability vs Growth", "I prefer proven methods over experimental approaches.", "Stability"],
    ["Stability vs Growth", "I welcome feedback that challenges my current approach.", "Growth"],
    ["Autonomy vs Structure", "I prefer setting my own deadlines.", "Autonomy"],
    ["Autonomy vs Structure", "I work best with a detailed project plan.", "Structure"],
    ["Autonomy vs Structure", "I like to choose the tools and methods I use.", "Autonomy"],
    ["Autonomy vs Structure", "I appreciate clear role descriptions and boundaries.", "Structure"],
    ["Autonomy vs Structure", "I prefer minimal supervision.", "Autonomy"],
    ["Autonomy vs Structure", "I thrive when SOPs are well documented.", "Structure"],
    ["Autonomy vs Structure", "I want the freedom to experiment with my workflow.", "Autonomy"],
    ["Autonomy vs Structure", "I feel secure when expectations are written down.", "Structure"],
    ["Autonomy vs Structure", "I resist micromanagement.", "Autonomy"],
    ["Autonomy vs Structure", "I value consistency in process over individual creativity.", "Structure"],
    ["Power vs Collaboration", "I want to be the final decision-maker.", "Power"],
    ["Power vs Collaboration", "I prefer consensus-driven decisions.", "Collaboration"],
    ["Power vs Collaboration", "I seek positions of authority.", "Power"],
    ["Power vs Collaboration", "I enjoy facilitating group discussions.", "Collaboration"],
    ["Power vs Collaboration", "I like being accountable for outcomes.", "Power"],
    ["Power vs Collaboration", "I believe the best ideas emerge from group dialogue.", "Collaboration"],
    ["Power vs Collaboration", "I want direct reports and a leadership title.", "Power"],
    ["Power vs Collaboration", "I value peer relationships over hierarchical ones.", "Collaboration"],
    ["Power vs Collaboration", "I enjoy having a visible seat at the table.", "Power"],
    ["Power vs Collaboration", "I prefer joint ownership of deliverables.", "Collaboration"],
    ["Financial vs Mastery vs Purpose", "I measure success by financial milestones.", "Financial"],
    ["Financial vs Mastery vs Purpose", "I measure success by expertise depth.", "Mastery"],
    ["Financial vs Mastery vs Purpose", "I measure success by positive change created.", "Purpose"],
    ["Financial vs Mastery vs Purpose", "I am motivated by stock options and equity.", "Financial"],
    ["Financial vs Mastery vs Purpose", "I want to be recognised as a subject-matter expert.", "Mastery"],
    ["Financial vs Mastery vs Purpose", "I want to leave a legacy that outlasts my career.", "Purpose"],
    ["Stability vs Growth", "I value health insurance and job security equally.", "Stability"],
    ["Stability vs Growth", "I am willing to relocate for a growth opportunity.", "Growth"],
    ["Autonomy vs Structure", "I prefer remote work for flexibility.", "Autonomy"],
    ["Autonomy vs Structure", "I prefer office environments for routine.", "Structure"],
    ["Power vs Collaboration", "I want influence over strategic direction.", "Power"],
    ["Power vs Collaboration", "I value being part of a cohesive team.", "Collaboration"],
    ["Financial vs Mastery vs Purpose", "I feel fulfilled when my salary reflects my market value.", "Financial"],
    ["Financial vs Mastery vs Purpose", "I feel fulfilled when I solve a problem no one else could.", "Mastery"],
    ["Financial vs Mastery vs Purpose", "I feel fulfilled when my work helps real people.", "Purpose"],
    ["Stability vs Growth", "I want a role I can do well for years.", "Stability"],
    ["Stability vs Growth", "I want a role that changes every 12 months.", "Growth"],
    ["Autonomy vs Structure", "I want to own my calendar.", "Autonomy"],
    ["Autonomy vs Structure", "I appreciate structured meeting cadences.", "Structure"],
    ["Power vs Collaboration", "I enjoy competitive environments.", "Power"],
    ["Power vs Collaboration", "I enjoy supportive environments.", "Collaboration"],
    ["Financial vs Mastery vs Purpose", "I would choose a higher-paying job over a more interesting one.", "Financial"],
    ["Financial vs Mastery vs Purpose", "I would choose a more interesting job over a higher-paying one.", "Mastery"],
    ["Stability vs Growth", "I prefer well-established companies over startups.", "Stability"],
    ["Stability vs Growth", "I prefer startups over well-established companies.", "Growth"],
    ["Autonomy vs Structure", "I like defining my own KPIs.", "Autonomy"],
    ["Autonomy vs Structure", "I like having KPIs defined for me.", "Structure"],
    ["Power vs Collaboration", "I am energised by competition with peers.", "Power"],
    ["Power vs Collaboration", "I am energised by collective achievement.", "Collaboration"],
    ["Financial vs Mastery vs Purpose", "I track industry salary surveys.", "Financial"],
    ["Financial vs Mastery vs Purpose", "I track industry thought leaders.", "Mastery"],
    ["Financial vs Mastery vs Purpose", "I track social impact metrics.", "Purpose"],
    ["Stability vs Growth", "I value a guaranteed bonus.", "Stability"],
    ["Stability vs Growth", "I value a high-variance bonus tied to stretch goals.", "Growth"],
    ["Autonomy vs Structure", "I enjoy creating processes from scratch.", "Autonomy"],
    ["Autonomy vs Structure", "I enjoy optimising existing processes.", "Structure"],
    ["Power vs Collaboration", "I advocate for my team's budget aggressively.", "Power"],
    ["Power vs Collaboration", "I share resources across teams willingly.", "Collaboration"],
    ["Financial vs Mastery vs Purpose", "I see compensation as the primary measure of professional worth.", "Financial"],
    ["Financial vs Mastery vs Purpose", "I see capability growth as the primary measure of professional worth.", "Mastery"],
  ];

  return statements.map(([sub, stem, archetype], i) => ({
    created_by,
    item_type: "Q_SORT" as const,
    layer_code: "MOTIVATORS" as const,
    review_status: "APPROVED" as const,
    scoring_key: {
      archetype_cluster_hint: archetype,
      distribution: ["Most Important", "Important", "Somewhat Important", "Least Important"],
    },
    stem: `${stem} [Exp ${i + 1}]`,
    sub_dimension_name: sub,
    tags: { archetype, role_family_usage: role_family_segments },
    time_limit_seconds: null,
  }));
}

// ─── LIKERT extras (45 more → total ~100) ────────────────────────────────────

function build_extra_likert(created_by: string): SeedItem[] {
  const items: Array<[string, string, string, boolean]> = [
    // [layer, sub_dimension, stem, reverse_scored]
    ["EXECUTION", "Planning ability", "I write down assumptions before starting a new project.", false],
    ["EXECUTION", "Planning ability", "I allocate buffer time in project schedules.", false],
    ["EXECUTION", "Planning ability", "I review previous project retrospectives before planning new ones.", false],
    ["EXECUTION", "Closure rate", "I follow up on delegated work until confirmed complete.", false],
    ["EXECUTION", "Closure rate", "I leave some tasks unfinished when something more exciting comes up.", true],
    ["EXECUTION", "Closure rate", "I document lessons learned after project completion.", false],
    ["EXECUTION", "Process discipline", "I report process deviations even when nobody notices.", false],
    ["EXECUTION", "Process discipline", "I sometimes bypass approval steps to save time.", true],
    ["EXECUTION", "Process discipline", "I maintain standard operating procedures for my recurring tasks.", false],
    ["EXECUTION", "Attention to detail", "I verify data accuracy before sharing reports.", false],
    ["EXECUTION", "Attention to detail", "I sometimes overlook minor errors in non-critical documents.", true],
    ["EXECUTION", "Attention to detail", "I cross-reference multiple data sources before drawing conclusions.", false],
    ["EXECUTION", "Prioritisation", "I distinguish between urgent and important tasks daily.", false],
    ["EXECUTION", "Prioritisation", "I struggle to say no to low-priority requests.", true],
    ["EXECUTION", "Prioritisation", "I review my task list at the start and end of each day.", false],
    ["LEADERSHIP", "Influence", "This person builds coalitions before proposing major changes.", false],
    ["LEADERSHIP", "Influence", "This person uses data to support their arguments.", false],
    ["LEADERSHIP", "Influence", "This person tailors their message to their audience.", false],
    ["LEADERSHIP", "Conflict handling", "This person stays composed when conversations become heated.", false],
    ["LEADERSHIP", "Conflict handling", "This person avoids sweeping issues under the rug.", false],
    ["LEADERSHIP", "Conflict handling", "This person facilitates resolution rather than taking sides.", false],
    ["LEADERSHIP", "Feedback receptivity", "This person asks specific follow-up questions after receiving feedback.", false],
    ["LEADERSHIP", "Feedback receptivity", "This person implements suggested changes promptly.", false],
    ["LEADERSHIP", "Feedback receptivity", "This person shares lessons learned from past mistakes.", false],
    ["LEADERSHIP", "Delegation", "This person matches tasks to team members' strengths.", false],
    ["LEADERSHIP", "Delegation", "This person provides context, not just instructions.", false],
    ["LEADERSHIP", "Delegation", "This person trusts the team to deliver without micromanaging.", false],
    ["LEADERSHIP", "Team energy", "This person celebrates small wins regularly.", false],
    ["LEADERSHIP", "Team energy", "This person shields the team from unnecessary pressure.", false],
    ["LEADERSHIP", "Team energy", "This person maintains enthusiasm even during difficult phases.", false],
    ["EXECUTION", "Planning ability", "I define exit criteria before starting negotiations.", false],
    ["EXECUTION", "Closure rate", "I prefer completing all open items before taking on new work.", false],
    ["EXECUTION", "Process discipline", "I refer to checklists for complex procedures.", false],
    ["EXECUTION", "Attention to detail", "I proofread important communications twice.", false],
    ["EXECUTION", "Prioritisation", "I communicate trade-offs when reprioritising.", false],
    ["LEADERSHIP", "Influence", "This person creates compelling business cases.", false],
    ["LEADERSHIP", "Conflict handling", "This person acknowledges disagreements early.", false],
    ["LEADERSHIP", "Feedback receptivity", "This person does not take constructive feedback personally.", false],
    ["LEADERSHIP", "Delegation", "This person empowers team members to make decisions.", false],
    ["LEADERSHIP", "Team energy", "This person brings positive energy to team meetings.", false],
    ["EXECUTION", "Planning ability", "I anticipate risks before they materialise.", false],
    ["EXECUTION", "Closure rate", "I track open items in a shared system.", false],
    ["EXECUTION", "Process discipline", "I automate repeatable tasks wherever possible.", false],
    ["EXECUTION", "Attention to detail", "I notice inconsistencies in data before presenting it.", false],
    ["EXECUTION", "Prioritisation", "I protect time for strategic work from daily firefighting.", false],
  ];

  return items.map(([layer, sub, stem, reverse], i) => ({
    created_by,
    item_options: likert_options,
    item_type: "LIKERT" as const,
    layer_code: layer as "EXECUTION" | "LEADERSHIP",
    review_status: "APPROVED" as const,
    scoring_key: { reverse_scored: reverse, ...(layer === "LEADERSHIP" ? { audience: "RATER" } : {}) },
    stem: `${stem} [Exp ${i + 1}]`,
    sub_dimension_name: sub,
    tags: {
      audience: layer === "LEADERSHIP" ? "RATER" : "CANDIDATE",
      reverse_scored: reverse,
      role_family_usage: role_family_segments,
    },
    time_limit_seconds: 45,
  }));
}

// ─── SCENARIO extras (40 more → total ~100) ──────────────────────────────────

function build_extra_scenarios(created_by: string): SeedItem[] {
  type ScenarioDef = {
    layer: "EXECUTION" | "LEADERSHIP" | "SJT";
    sub: string;
    stem: string;
    options: Array<[string, number]>;
  };

  const defs: ScenarioDef[] = [
    { layer: "SJT", sub: "Problem framing", stem: "A key vendor missed three consecutive deliveries. Your team is split on whether to switch vendors or renegotiate.", options: [["Analyse root cause with the vendor, set measurable improvement targets, and prepare a backup vendor in parallel.", 4], ["Switch immediately to avoid further delays.", 2], ["Wait for one more missed delivery before acting.", 0], ["Let the procurement team decide.", 1]] },
    { layer: "SJT", sub: "Stakeholder trade-off navigation", stem: "Your CEO wants to enter a new market within 60 days. Your ops team says 90 days minimum for quality.", options: [["Present a phased plan — soft launch in 60 days with limited SKUs, full launch in 90.", 4], ["Commit to 60 days and figure it out later.", 0], ["Refuse and insist on 90 days.", 2], ["Escalate the disagreement to the board.", 1]] },
    { layer: "SJT", sub: "Resource constraint decisions", stem: "Budget cuts require reducing your team by 15%. Two approaches: cut junior staff or reduce hours across the board.", options: [["Model both options against deliverables, consult the team, and recommend the approach with least impact on critical projects.", 4], ["Cut junior staff to protect senior expertise.", 2], ["Reduce hours equally — it's fairer.", 1], ["Ask each person to volunteer for cuts.", 0]] },
    { layer: "SJT", sub: "Escalation judgment", stem: "A customer complaint reveals a pattern of shipping errors over three months that nobody reported.", options: [["Investigate the root cause, implement corrective actions, and set up monitoring before reporting to leadership with a resolution plan.", 4], ["Fire the logistics coordinator.", 0], ["Report to leadership immediately without investigating.", 2], ["Apologise to the customer and move on.", 1]] },
    { layer: "SJT", sub: "Ethical boundary recognition", stem: "A colleague asks you to approve overtime hours they did not actually work because 'everyone does it'.", options: [["Decline, explain the policy, and report the pattern to HR.", 4], ["Approve it this once as a favour.", 0], ["Decline but do not report it.", 2], ["Approve it and ask them to stop in the future.", 1]] },
    { layer: "EXECUTION", sub: "Planning ability", stem: "You discover mid-project that a critical assumption in your plan was wrong. 60% of the work is done.", options: [["Reassess the plan, identify what can be salvaged, create a revised timeline and communicate transparently.", 4], ["Continue as planned and hope it works out.", 0], ["Start over from scratch.", 1], ["Blame the person who gave you the wrong assumption.", 0]] },
    { layer: "EXECUTION", sub: "Prioritisation", stem: "You have three deadlines this week. Your manager adds a fourth urgent task on Tuesday.", options: [["List all four tasks with effort estimates, propose trade-offs, and confirm the revised priority with your manager.", 4], ["Work overtime to do all four without discussing it.", 2], ["Drop the least important task silently.", 0], ["Complete the new task first because it's from your manager.", 1]] },
    { layer: "EXECUTION", sub: "Process discipline", stem: "A shortcut in your team's process saves 2 hours per week but bypasses a quality check.", options: [["Reinstate the quality check, then find a way to make the check faster to preserve the time savings.", 4], ["Keep the shortcut — no defects so far.", 0], ["Reinstate the check without seeking efficiency.", 2], ["Let the team vote on it.", 1]] },
    { layer: "EXECUTION", sub: "Attention to detail", stem: "You notice a data discrepancy in a report that has already been sent to a client.", options: [["Contact the client immediately with a corrected report and a brief explanation.", 4], ["Wait to see if the client notices.", 0], ["Fix it quietly in the next report.", 1], ["Send a corrected report without acknowledging the error.", 2]] },
    { layer: "EXECUTION", sub: "Closure rate", stem: "A project you led was 95% successful but one deliverable was left incomplete. Your team wants to move on.", options: [["Close the final deliverable properly, document it, then transition.", 4], ["Declare it done — 95% is close enough.", 1], ["Move on and come back if anyone asks.", 0], ["Assign it to a junior team member without context.", 0]] },
    { layer: "LEADERSHIP", sub: "Influence", stem: "Your proposal for a new initiative was rejected in the leadership meeting. You believe it has merit.", options: [["Seek feedback on the objections, refine your case with data, and request another slot.", 4], ["Implement it anyway without approval.", 0], ["Drop it permanently.", 1], ["Complain to colleagues.", 0]] },
    { layer: "LEADERSHIP", sub: "Conflict handling", stem: "Two of your direct reports have a personal disagreement that is affecting project timelines.", options: [["Meet each person privately, understand perspectives, then facilitate a structured conversation focused on work impact.", 4], ["Tell them to sort it out themselves.", 1], ["Take one person's side.", 0], ["Separate them onto different projects permanently.", 2]] },
    { layer: "LEADERSHIP", sub: "Feedback receptivity", stem: "Your team gives you feedback that your communication style feels abrupt and dismissive.", options: [["Thank them, ask for specific examples, and commit to measurable changes.", 4], ["Defend your style as efficient.", 0], ["Apologise but change nothing.", 1], ["Ask who specifically said it.", 0]] },
    { layer: "LEADERSHIP", sub: "Delegation", stem: "A task you delegated was completed poorly. The deadline is tomorrow.", options: [["Provide specific feedback on what needs fixing, offer support, and set a check-in for the end of today.", 4], ["Redo it yourself overnight.", 2], ["Submit it as is.", 0], ["Blame the team member in the status meeting.", 0]] },
    { layer: "LEADERSHIP", sub: "Team energy", stem: "Your team just went through a difficult quarter with two missed targets. Morale is low.", options: [["Acknowledge the difficulty, celebrate what went well, identify specific lessons, and set achievable near-term goals.", 4], ["Ignore morale and focus on next quarter's targets.", 0], ["Give everyone a day off.", 2], ["Blame external factors to make the team feel better.", 1]] },
    { layer: "SJT", sub: "Problem framing", stem: "Customer returns have doubled this month but the QC pass rate is unchanged.", options: [["Investigate the gap between QC criteria and actual customer expectations — the pass criteria may be wrong.", 4], ["Increase QC sampling rate.", 2], ["Blame the shipping team.", 0], ["Offer refunds to all affected customers without investigating.", 1]] },
    { layer: "SJT", sub: "Stakeholder trade-off navigation", stem: "The sales team promised a feature to a major client that engineering says will take 6 months. The client expects it in 2.", options: [["Meet with sales and engineering together, agree on what's achievable in 2 months, and renegotiate with the client transparently.", 4], ["Tell sales to stop making promises.", 1], ["Tell engineering to work faster.", 0], ["Promise the client 2 months and worry later.", 0]] },
    { layer: "SJT", sub: "Resource constraint decisions", stem: "You have budget for one hire. You need both a senior engineer and two junior ones.", options: [["Hire the senior engineer and plan to upskill existing juniors to bridge the gap.", 4], ["Hire two juniors because you need headcount.", 2], ["Delay hiring until you get more budget.", 1], ["Hire neither and redistribute work.", 0]] },
    { layer: "SJT", sub: "Escalation judgment", stem: "A minor safety incident occurred but nobody was hurt. Reporting it will trigger a lengthy investigation.", options: [["Report it immediately — near-misses are leading indicators.", 4], ["Log it privately and monitor.", 2], ["Ignore it — nobody was hurt.", 0], ["Wait for a more serious incident before reporting.", 0]] },
    { layer: "SJT", sub: "Ethical boundary recognition", stem: "A partner company offers you a personal gift worth Rs 50,000 after signing a contract your team negotiated.", options: [["Politely decline and inform your compliance team.", 4], ["Accept it — the contract is already signed.", 0], ["Accept but donate it to charity.", 2], ["Accept but don't tell anyone.", 0]] },
  ];

  return Array.from({ length: 40 }, (_, i) => {
    const d = defs[i % defs.length];
    return {
      created_by,
      item_options: d.options.map(([text, weight], oi) => ({
        display_order: oi + 1,
        option_text: text,
        score_weight: weight,
      })),
      item_type: "SCENARIO" as const,
      layer_code: d.layer,
      review_status: "APPROVED" as const,
      scoring_key: {
        model: "partial_credit_0_4",
        ...(d.layer === "LEADERSHIP" ? { audience: "SELF" } : {}),
        ...(d.layer === "SJT" ? { rationale_required: true } : {}),
        ...(d.layer === "EXECUTION" ? { role_context: "industrial_operations" } : {}),
      },
      stem: `${d.stem} [Exp ${i + 1}]`,
      sub_dimension_name: d.sub,
      tags: { audience: "CANDIDATE", role_family_usage: role_family_segments },
      time_limit_seconds: d.layer === "SJT" ? 120 : 90,
    };
  });
}

// ─── RANKING (100 new) ───────────────────────────────────────────────────────

function build_ranking_items(created_by: string): SeedItem[] {
  type RankDef = { sub: string; stem: string; items: string[] };

  const templates: RankDef[] = [
    { sub: "Prioritisation", stem: "Rank these production priorities from most to least important for a plant manager:", items: ["Safety compliance", "On-time delivery", "Cost optimisation", "Employee morale"] },
    { sub: "Planning ability", stem: "Rank these project planning steps in the order they should happen:", items: ["Define scope", "Identify stakeholders", "Estimate resources", "Set milestones"] },
    { sub: "Closure rate", stem: "Rank these actions by urgency when a project is 90% complete:", items: ["Close remaining tasks", "Document lessons learned", "Start next project", "Celebrate completion"] },
    { sub: "Process discipline", stem: "Rank these quality assurance steps by importance:", items: ["Input inspection", "In-process check", "Final inspection", "Customer feedback review"] },
    { sub: "Attention to detail", stem: "Rank these data validation steps by when they should occur:", items: ["Source data check", "Calculation verification", "Format review", "Final sign-off"] },
    { sub: "Influence", stem: "Rank these leadership communication priorities:", items: ["Clear vision", "Active listening", "Timely feedback", "Recognition of effort"] },
    { sub: "Conflict handling", stem: "Rank these conflict resolution steps in order:", items: ["Understand perspectives", "Identify common ground", "Propose solutions", "Agree on next steps"] },
    { sub: "Delegation", stem: "Rank these delegation best practices by importance:", items: ["Match task to capability", "Provide context", "Set checkpoints", "Trust the team member"] },
    { sub: "Problem framing", stem: "Rank these problem-solving steps in order:", items: ["Define the problem", "Gather data", "Identify root cause", "Implement solution"] },
    { sub: "Stakeholder trade-off navigation", stem: "Rank these stakeholder management actions by priority:", items: ["Identify stakeholders", "Understand interests", "Communicate transparently", "Manage expectations"] },
    { sub: "Prioritisation", stem: "Rank these factors when deciding which customer order to fulfil first:", items: ["Strategic importance", "Revenue value", "Delivery deadline", "Relationship history"] },
    { sub: "Planning ability", stem: "Rank these risk management steps in order:", items: ["Identify risks", "Assess probability", "Plan mitigations", "Monitor triggers"] },
    { sub: "Team energy", stem: "Rank these team morale actions by impact:", items: ["Public recognition", "Career development", "Fair workload distribution", "Team social events"] },
    { sub: "Feedback receptivity", stem: "Rank these feedback practices by effectiveness:", items: ["Ask clarifying questions", "Take notes", "Follow up with actions", "Thank the giver"] },
    { sub: "Ethical boundary recognition", stem: "Rank these ethical considerations by importance in business decisions:", items: ["Legal compliance", "Employee safety", "Customer trust", "Shareholder value"] },
    { sub: "Resource constraint decisions", stem: "Rank these resource allocation criteria:", items: ["Strategic alignment", "Return on investment", "Team capability", "Time sensitivity"] },
    { sub: "Escalation judgment", stem: "Rank these factors when deciding whether to escalate an issue:", items: ["Severity of impact", "Time sensitivity", "Your authority to resolve", "Stakeholder visibility"] },
    { sub: "Process discipline", stem: "Rank these continuous improvement actions:", items: ["Measure current state", "Identify bottlenecks", "Test improvements", "Standardise changes"] },
    { sub: "Closure rate", stem: "Rank these project close-out activities:", items: ["Final deliverable check", "Stakeholder sign-off", "Documentation", "Team debrief"] },
    { sub: "Attention to detail", stem: "Rank these report review priorities:", items: ["Data accuracy", "Logical flow", "Visual clarity", "Grammar and formatting"] },
  ];

  return Array.from({ length: 100 }, (_, i) => {
    const t = templates[i % templates.length];
    const layer = ["Prioritisation", "Planning ability", "Closure rate", "Process discipline", "Attention to detail"].includes(t.sub)
      ? "EXECUTION" as const
      : ["Influence", "Conflict handling", "Delegation", "Team energy", "Feedback receptivity"].includes(t.sub)
        ? "LEADERSHIP" as const
        : "SJT" as const;

    return {
      created_by,
      item_type: "RANKING" as const,
      layer_code: layer,
      review_status: "APPROVED" as const,
      scoring_key: {
        model: "rank_order_correlation",
        ideal_order: t.items,
      },
      stem: `${t.stem} [Rank ${i + 1}]`,
      sub_dimension_name: t.sub,
      tags: { role_family_usage: role_family_segments },
      time_limit_seconds: 60,
      item_options: t.items.map((item, oi) => ({
        display_order: oi + 1,
        option_text: item,
        score_weight: t.items.length - oi,
      })),
    };
  });
}

// ─── FORCED_CHOICE_PAIR (100 new) ────────────────────────────────────────────

function build_forced_choice_pair_items(created_by: string): SeedItem[] {
  const pairs: Array<[string, string, string, string]> = [
    // [sub_dimension, statement_a, statement_b, trait_a]
    ["Conscientiousness", "I prefer a well-organised workspace.", "I work best in creative clutter.", "Conscientiousness"],
    ["Openness", "I enjoy trying new approaches.", "I prefer proven methods.", "Openness"],
    ["Emotional Stability", "I stay calm under pressure.", "I feel stress acutely but use it as fuel.", "Emotional Stability"],
    ["Extraversion", "I prefer working with others.", "I prefer working alone.", "Extraversion"],
    ["Agreeableness", "I prioritise harmony.", "I prioritise honesty even if it's uncomfortable.", "Agreeableness"],
    ["Risk Appetite", "I take bold risks.", "I prefer safe choices.", "Risk Appetite"],
    ["Bias for Action", "I act first and adjust later.", "I plan thoroughly before acting.", "Bias for Action"],
    ["Conscientiousness", "I keep detailed to-do lists.", "I rely on memory for task management.", "Conscientiousness"],
    ["Openness", "I seek unfamiliar experiences.", "I prefer familiar routines.", "Openness"],
    ["Emotional Stability", "I recover quickly from setbacks.", "I process setbacks deeply before moving on.", "Emotional Stability"],
    ["Extraversion", "I enjoy large group settings.", "I prefer one-on-one conversations.", "Extraversion"],
    ["Agreeableness", "I look for compromise.", "I stand firm on my position.", "Agreeableness"],
    ["Risk Appetite", "I bet on uncertain outcomes.", "I wait for certainty before committing.", "Risk Appetite"],
    ["Bias for Action", "I prefer speed over perfection.", "I prefer perfection over speed.", "Bias for Action"],
    ["Conscientiousness", "I double-check my work habitually.", "I trust my first pass.", "Conscientiousness"],
    ["Openness", "I welcome surprise challenges.", "I prefer predictable work.", "Openness"],
    ["Emotional Stability", "I compartmentalise emotions at work.", "I express emotions openly at work.", "Emotional Stability"],
    ["Extraversion", "I initiate conversations with strangers.", "I wait for others to approach me.", "Extraversion"],
    ["Agreeableness", "I adjust to others' needs.", "I expect others to adjust to mine.", "Agreeableness"],
    ["Risk Appetite", "I see failure as a learning opportunity.", "I see failure as something to avoid.", "Risk Appetite"],
    ["Bias for Action", "I start before all information is available.", "I wait for complete information.", "Bias for Action"],
    ["Conscientiousness", "I follow rules closely.", "I interpret rules flexibly.", "Conscientiousness"],
    ["Openness", "I prefer creative projects.", "I prefer structured projects.", "Openness"],
    ["Emotional Stability", "I rarely worry about outcomes.", "I often anticipate negative outcomes.", "Emotional Stability"],
    ["Extraversion", "I draw energy from social events.", "I draw energy from quiet reflection.", "Extraversion"],
  ];

  return Array.from({ length: 100 }, (_, i) => {
    const [sub, a, b, trait] = pairs[i % pairs.length];
    return {
      created_by,
      desirability_rating: 4,
      item_type: "FORCED_CHOICE_PAIR" as const,
      layer_code: "PERSONALITY" as const,
      review_status: "APPROVED" as const,
      scoring_key: {
        model: "ipsative_pair",
        statement_a_trait: trait,
        statement_b_trait: sub === trait ? "counter_" + trait : sub,
      },
      stem: "Choose the statement that describes you more accurately.",
      sub_dimension_name: sub,
      tags: { role_family_usage: role_family_segments, trait },
      time_limit_seconds: 30,
      item_options: [
        { display_order: 1, option_text: `${a} [Pair ${i + 1}]`, score_weight: 1 },
        { display_order: 2, option_text: b, score_weight: 0 },
      ],
    };
  });
}

// ─── SINGLE_CHOICE_TIMED (100 new) ───────────────────────────────────────────

function build_single_choice_timed_items(created_by: string): SeedItem[] {
  const templates: Array<{
    sub: string;
    stem: string;
    options: string[];
    answer: string;
    difficulty: number;
  }> = [
    { sub: "Logical reasoning", stem: "If A > B and B > C, then:", options: ["A > C", "C > A", "A = C", "Cannot determine"], answer: "A > C", difficulty: -1 },
    { sub: "Numerical reasoning", stem: "What is 15% of 240?", options: ["32", "36", "40", "44"], answer: "36", difficulty: -1 },
    { sub: "Verbal reasoning", stem: "Opposite of 'concise':", options: ["Brief", "Verbose", "Clear", "Sharp"], answer: "Verbose", difficulty: -1 },
    { sub: "Logical reasoning", stem: "Which number completes the pattern: 1, 1, 2, 3, 5, __?", options: ["7", "8", "9", "10"], answer: "8", difficulty: 0 },
    { sub: "Numerical reasoning", stem: "A product costs Rs 800 after a 20% discount. What was the original price?", options: ["Rs 960", "Rs 1,000", "Rs 1,040", "Rs 1,200"], answer: "Rs 1,000", difficulty: 0 },
    { sub: "Verbal reasoning", stem: "Which word is most similar to 'efficacious'?", options: ["Efficient", "Effective", "Elegant", "Elaborate"], answer: "Effective", difficulty: 0 },
    { sub: "Logical reasoning", stem: "All roses are flowers. Some flowers fade quickly. Therefore:", options: ["All roses fade quickly.", "Some roses may fade quickly.", "No roses fade quickly.", "Roses are not flowers."], answer: "Some roses may fade quickly.", difficulty: 1.5 },
    { sub: "Numerical reasoning", stem: "If compound interest on Rs 10,000 at 10% pa for 2 years is:", options: ["Rs 2,000", "Rs 2,100", "Rs 2,200", "Rs 2,310"], answer: "Rs 2,100", difficulty: 1.5 },
    { sub: "Abstract pattern recognition", stem: "In a sequence of shapes, each rotates 45° clockwise. What angle is the 5th shape at?", options: ["180°", "225°", "270°", "315°"], answer: "225°", difficulty: 0 },
    { sub: "Abstract pattern recognition", stem: "If triangle → 3, square → 4, pentagon → 5, then hexagon → ?", options: ["5", "6", "7", "8"], answer: "6", difficulty: -1 },
    { sub: "Logical reasoning", stem: "None of the managers were absent. The meeting had full attendance. This means:", options: ["All managers attended.", "Some managers attended.", "The meeting was cancelled.", "Cannot determine."], answer: "All managers attended.", difficulty: -1 },
    { sub: "Numerical reasoning", stem: "Average of 10, 20, 30, 40, 50 is:", options: ["25", "30", "35", "40"], answer: "30", difficulty: -1 },
    { sub: "Verbal reasoning", stem: "Synonym for 'ubiquitous':", options: ["Rare", "Everywhere", "Unique", "Hidden"], answer: "Everywhere", difficulty: 0 },
    { sub: "Logical reasoning", stem: "If no A is B, and all B is C, then:", options: ["Some A is C.", "No A is C.", "All A is C.", "Cannot determine."], answer: "Cannot determine.", difficulty: 1.5 },
    { sub: "Numerical reasoning", stem: "Ratio of 750 to 1,000 expressed as a percentage:", options: ["65%", "70%", "75%", "80%"], answer: "75%", difficulty: -1 },
    { sub: "Abstract pattern recognition", stem: "Next in series: ○●○●○ → ?", options: ["●", "○", "●○", "○●"], answer: "●", difficulty: -1 },
    { sub: "Verbal reasoning", stem: "Antonym of 'benevolent':", options: ["Kind", "Malevolent", "Generous", "Neutral"], answer: "Malevolent", difficulty: 0 },
    { sub: "Logical reasoning", stem: "If P implies Q, and Q is false, then P is:", options: ["True", "False", "Unknown", "Irrelevant"], answer: "False", difficulty: 1.5 },
    { sub: "Numerical reasoning", stem: "What is the area of a rectangle 12m × 8m?", options: ["80 sq m", "96 sq m", "100 sq m", "120 sq m"], answer: "96 sq m", difficulty: -1 },
    { sub: "Verbal reasoning", stem: "Choose the correct spelling:", options: ["Accomodate", "Accommodate", "Acommodate", "Acomodate"], answer: "Accommodate", difficulty: -1 },
  ];

  return Array.from({ length: 100 }, (_, i) => {
    const t = templates[i % templates.length];
    const diff_label = i < 34 ? "easy" : i < 67 ? "medium" : "hard";
    const time = diff_label === "easy" ? 15 : diff_label === "medium" ? 20 : 25;

    return {
      correct_answer: { option_text: t.answer },
      created_by,
      difficulty_b: t.difficulty,
      discrimination_a: 1.2,
      guessing_c: 0.25,
      item_type: "SINGLE_CHOICE_TIMED" as const,
      layer_code: "COGNITIVE" as const,
      review_status: "APPROVED" as const,
      scoring_key: {
        accuracy_weight: 0.5,
        speed_weight: 0.5,
        correct_option: t.answer,
        time_limit_seconds: time,
      },
      stem: `${t.stem} [Timed ${i + 1}]`,
      sub_dimension_name: t.sub,
      tags: { difficulty: diff_label, role_family_usage: role_family_segments, timed: true },
      time_limit_seconds: time,
      item_options: t.options.map((opt, oi) => ({
        display_order: oi + 1,
        is_correct: opt === t.answer,
        option_text: opt,
        score_weight: opt === t.answer ? 1 : 0,
      })),
    };
  });
}

// ─── SIMULATION (100 new) ────────────────────────────────────────────────────

function build_simulation_items(created_by: string): SeedItem[] {
  const templates: Array<{
    sub: string;
    stem: string;
    options: Array<[string, number]>;
    context: string;
  }> = [
    { sub: "Stakeholder trade-off navigation", context: "customer_escalation", stem: "Simulation: A major customer calls threatening to cancel. You have limited discount authority. What do you do first?", options: [["Listen fully, acknowledge their concern, and ask what resolution they'd accept.", 4], ["Offer the maximum discount immediately.", 1], ["Transfer to your manager.", 2], ["Explain that you can't help.", 0]] },
    { sub: "Problem framing", context: "production_bottleneck", stem: "Simulation: Line 3 is running at 60% capacity. You need to diagnose the issue in the next 30 minutes.", options: [["Check the top 3 common failure points, review recent maintenance logs, and talk to the line operator.", 4], ["Shut down the line for full inspection.", 2], ["Wait for the engineering team's scheduled visit.", 0], ["Increase speed on Lines 1 and 2 to compensate.", 1]] },
    { sub: "Resource constraint decisions", context: "budget_allocation", stem: "Simulation: You receive an unexpected budget cut of 10% mid-quarter. Three projects are running.", options: [["Assess each project's ROI and strategic importance, then propose targeted cuts to the lowest-impact areas.", 4], ["Cut all three projects equally by 10%.", 2], ["Cancel the smallest project entirely.", 1], ["Ignore the cut and hope for a reversal.", 0]] },
    { sub: "Escalation judgment", context: "safety_incident", stem: "Simulation: A near-miss safety incident just happened on the factory floor. Nobody was injured.", options: [["Secure the area, file an incident report immediately, and conduct a root-cause analysis within 24 hours.", 4], ["Note it and include it in the monthly safety report.", 1], ["Verbally warn the worker involved.", 2], ["Do nothing since nobody was hurt.", 0]] },
    { sub: "Ethical boundary recognition", context: "data_privacy", stem: "Simulation: You discover an employee shared customer data with an unauthorised third party for a sales lead.", options: [["Report it to compliance, restrict the employee's data access, and notify the affected customers.", 4], ["Give the employee a verbal warning.", 1], ["Ignore it because the lead was valuable.", 0], ["Ask the employee to delete the shared data and move on.", 2]] },
    { sub: "Influence", context: "change_management", stem: "Simulation: You need to convince a resistant team to adopt a new CRM system within 30 days.", options: [["Identify champions, demonstrate clear benefits with their actual data, and provide hands-on training.", 4], ["Send an email announcing the change.", 0], ["Make it mandatory without explanation.", 1], ["Delay the rollout until resistance fades.", 0]] },
    { sub: "Conflict handling", context: "cross_functional", stem: "Simulation: Sales and operations are in a standoff about delivery commitments. A client meeting is in 2 hours.", options: [["Bring both leads together, align on what's achievable, and present a unified front to the client.", 4], ["Side with sales to protect the relationship.", 1], ["Side with operations to protect feasibility.", 2], ["Cancel the client meeting.", 0]] },
    { sub: "Delegation", context: "team_capacity", stem: "Simulation: Your team is overloaded. A new high-priority project lands on your desk.", options: [["Assess current workload, identify what can be deprioritised or reassigned, and delegate the new project with clear guardrails.", 4], ["Take it on yourself.", 2], ["Reject the project.", 0], ["Assign it to the least busy person without context.", 1]] },
    { sub: "Planning ability", context: "product_launch", stem: "Simulation: A product launch is 3 weeks away. Testing just revealed a significant bug.", options: [["Assess severity, determine if a fix is feasible in 3 weeks, and prepare both a fix plan and a contingency delay plan.", 4], ["Delay the launch indefinitely.", 1], ["Launch anyway and patch later.", 0], ["Blame the testing team.", 0]] },
    { sub: "Closure rate", context: "project_handover", stem: "Simulation: You're transitioning to a new role. Three projects need handover within one week.", options: [["Create detailed handover documents for each, schedule transition meetings with successors, and set up 30-day check-ins.", 4], ["Send a quick email with project links.", 1], ["Leave it for your successor to figure out.", 0], ["Only hand over the most critical project.", 2]] },
    { sub: "Process discipline", context: "compliance_audit", stem: "Simulation: An audit reveals your team skipped 3 mandatory compliance steps over the past month.", options: [["Acknowledge the gaps, implement immediate corrective actions, and set up automated reminders.", 4], ["Promise to do better next month.", 1], ["Blame the workload.", 0], ["Only fix the most visible gap.", 2]] },
    { sub: "Attention to detail", context: "financial_report", stem: "Simulation: While reviewing quarterly financials, you spot a Rs 2L discrepancy. The report is due in 1 hour.", options: [["Trace the discrepancy to its source, correct it, and note the correction in the report.", 4], ["Submit with the error and fix it next quarter.", 0], ["Round the numbers to hide it.", 0], ["Ask someone else to check it without flagging urgency.", 1]] },
    { sub: "Prioritisation", context: "crisis_management", stem: "Simulation: Three crises hit simultaneously: a server outage, a customer escalation, and an employee injury.", options: [["Address the employee injury first (safety), delegate server outage to IT, and communicate with the customer about a brief delay.", 4], ["Focus on the customer because revenue is at stake.", 1], ["Fix the server first as it affects everyone.", 2], ["Wait for your manager to assign priorities.", 0]] },
    { sub: "Team energy", context: "restructuring", stem: "Simulation: The company announces layoffs. Your team was not affected but morale has plummeted.", options: [["Hold a transparent team meeting, acknowledge their anxiety, and reaffirm the team's direction and value.", 4], ["Ignore it and focus on work.", 0], ["Tell them to be grateful they still have jobs.", 0], ["Organise a team outing to distract them.", 2]] },
    { sub: "Feedback receptivity", context: "performance_review", stem: "Simulation: During your own review, you receive surprising negative feedback about your communication style.", options: [["Ask for specific examples, take notes, thank the reviewer, and create a personal improvement plan.", 4], ["Disagree and defend your style.", 0], ["Accept it passively without action.", 1], ["Question the reviewer's credibility.", 0]] },
  ];

  return Array.from({ length: 100 }, (_, i) => {
    const t = templates[i % templates.length];
    const layer = ["Prioritisation", "Planning ability", "Closure rate", "Process discipline", "Attention to detail"].includes(t.sub)
      ? "EXECUTION" as const
      : ["Influence", "Conflict handling", "Delegation", "Team energy", "Feedback receptivity"].includes(t.sub)
        ? "LEADERSHIP" as const
        : "SJT" as const;

    return {
      created_by,
      item_type: "SIMULATION" as const,
      layer_code: layer,
      review_status: "APPROVED" as const,
      scoring_key: {
        model: "partial_credit_0_4",
        simulation_context: t.context,
        time_pressure: true,
      },
      stem: `${t.stem} [Sim ${i + 1}]`,
      sub_dimension_name: t.sub,
      tags: {
        role_family_usage: role_family_segments,
        simulation_context: t.context,
        interactive: true,
      },
      time_limit_seconds: 120,
      item_options: t.options.map(([text, weight], oi) => ({
        display_order: oi + 1,
        option_text: text,
        score_weight: weight,
      })),
    };
  });
}

// ─── Public export ───────────────────────────────────────────────────────────

export function build_expanded_question_bank(created_by: string): SeedItem[] {
  return [
    ...build_extra_mcq(created_by),            // +40  → MCQ total ~100
    ...build_extra_triads(created_by),         // +50  → FORCED_CHOICE_TRIAD total ~100
    ...build_extra_qsort(created_by),          // +80  → Q_SORT total ~100
    ...build_extra_likert(created_by),         // +45  → LIKERT total ~100
    ...build_extra_scenarios(created_by),      // +40  → SCENARIO total ~100
    ...build_ranking_items(created_by),        // +100 → RANKING total 100
    ...build_forced_choice_pair_items(created_by), // +100 → FORCED_CHOICE_PAIR total 100
    ...build_single_choice_timed_items(created_by), // +100 → SINGLE_CHOICE_TIMED total 100
    ...build_simulation_items(created_by),     // +100 → SIMULATION total 100
  ];
}
