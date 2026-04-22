/**
 * Strategic question bank — items for new sub-dimensions:
 * - Learning agility (COGNITIVE)
 * - Strategic thinking (LEADERSHIP)
 * - Change leadership (LEADERSHIP)
 * - Commercial acumen (SJT)
 *
 * Also includes tiered development recommendation content.
 */

import type { SeedItem } from "./question-bank";

const role_family_segments: string[] = [
  "Plant Operations Manager",
  "Key Account Manager",
  "Application / R&D Engineer",
  "Business Unit Leader",
  "Sales / BD",
  "Commercial / KAM",
  "Senior Plant Director",
  "Commercial Director",
  "COO / Head of Operations",
];

const likert_options = [
  { display_order: 1, option_text: "1 - Strongly disagree", score_weight: 1 },
  { display_order: 2, option_text: "2 - Disagree", score_weight: 2 },
  { display_order: 3, option_text: "3 - Neutral", score_weight: 3 },
  { display_order: 4, option_text: "4 - Agree", score_weight: 4 },
  { display_order: 5, option_text: "5 - Strongly agree", score_weight: 5 },
];

// ─── LEARNING AGILITY (COGNITIVE layer, MCQ format) ──────────────────────────

function build_learning_agility_items(created_by: string): SeedItem[] {
  const scenarios: Array<{
    stem: string;
    options: string[];
    answer: string;
    difficulty: number;
  }> = [
    {
      stem: "You are moved from managing a welding plant in Gujarat to leading a greenfield export operation in East Africa. You have no prior export experience. What is your first priority?",
      options: [
        "Apply the same management framework that worked in Gujarat",
        "Spend the first 2 weeks listening, observing local conditions, and mapping what is different from your prior context",
        "Hire consultants to build the operation while you learn",
        "Request a transfer back to a familiar role",
      ],
      answer: "Spend the first 2 weeks listening, observing local conditions, and mapping what is different from your prior context",
      difficulty: 0,
    },
    {
      stem: "A new ERP system replaces your team's familiar workflow. After 2 weeks, productivity has dropped 30%. What approach shows the strongest learning agility?",
      options: [
        "Revert to the old system until the team is trained",
        "Identify the 3 biggest friction points, run focused experiments to solve each, and share learnings daily",
        "Escalate to IT and wait for them to fix it",
        "Push the team to work harder to compensate",
      ],
      answer: "Identify the 3 biggest friction points, run focused experiments to solve each, and share learnings daily",
      difficulty: 0,
    },
    {
      stem: "You receive feedback that your communication style is too direct for the new team you've joined. You disagree — directness worked well in your previous role. What response demonstrates learning agility?",
      options: [
        "Maintain your style — it has always been effective",
        "Try adjusting your approach for 2 weeks, observe the team's response, and calibrate based on what you learn",
        "Avoid giving direct feedback entirely",
        "Ask HR to move you to a team that values directness",
      ],
      answer: "Try adjusting your approach for 2 weeks, observe the team's response, and calibrate based on what you learn",
      difficulty: -1,
    },
    {
      stem: "Your company acquires a smaller firm with a completely different culture — informal, fast-moving, and consensus-averse. You are asked to integrate their team into yours. What is the best first step?",
      options: [
        "Immediately apply your company's standard processes",
        "Map what works in their culture, what works in yours, and design an integration that preserves the best of both",
        "Let them operate independently and hope cultures merge",
        "Replace their leadership with people from your company",
      ],
      answer: "Map what works in their culture, what works in yours, and design an integration that preserves the best of both",
      difficulty: 1.5,
    },
    {
      stem: "You failed at a major product launch. The post-mortem reveals your demand forecast was wrong by 40%. What action demonstrates the highest learning agility?",
      options: [
        "Blame the market research team for bad data",
        "Document what assumptions were wrong, why, and build a revised forecasting method that accounts for the gap",
        "Avoid taking on forecasting responsibility in the future",
        "Move on quickly without a detailed review",
      ],
      answer: "Document what assumptions were wrong, why, and build a revised forecasting method that accounts for the gap",
      difficulty: -1,
    },
    {
      stem: "You are asked to lead a digital transformation initiative. You have deep manufacturing knowledge but limited digital experience. How do you approach this?",
      options: [
        "Decline — it requires digital expertise you don't have",
        "Accept, pair yourself with a digital-native partner, dedicate time each week to building your own digital literacy, and apply your manufacturing knowledge to shape the strategy",
        "Accept and rely entirely on external consultants",
        "Accept but delegate all digital decisions to the IT team",
      ],
      answer: "Accept, pair yourself with a digital-native partner, dedicate time each week to building your own digital literacy, and apply your manufacturing knowledge to shape the strategy",
      difficulty: 0,
    },
  ];

  return Array.from({ length: 30 }, (_, i) => {
    const s = scenarios[i % scenarios.length];
    const diff_label = i < 10 ? "easy" : i < 20 ? "medium" : "hard";
    return {
      correct_answer: { option_text: s.answer },
      created_by,
      difficulty_b: s.difficulty,
      discrimination_a: 1.1,
      guessing_c: 0.2,
      item_options: s.options.map((opt, oi) => ({
        display_order: oi + 1,
        is_correct: opt === s.answer,
        option_text: opt,
        score_weight: opt === s.answer ? 1 : 0,
      })),
      item_type: "MCQ" as const,
      layer_code: "COGNITIVE" as const,
      review_status: "APPROVED" as const,
      scoring_key: { accuracy_weight: 0.8, speed_weight: 0.2, correct_option: s.answer },
      stem: s.stem,
      sub_dimension_name: "Learning agility",
      tags: { difficulty: diff_label, role_family_usage: role_family_segments },
      time_limit_seconds: 90,
    };
  });
}

// ─── STRATEGIC THINKING (LEADERSHIP layer, SCENARIO format) ──────────────────

function build_strategic_thinking_items(created_by: string): SeedItem[] {
  const scenarios: Array<{
    stem: string;
    options: Array<[string, number]>;
  }> = [
    {
      stem: "Your company's core welding consumables business is growing at 4% per year. A new technology — laser welding — is growing at 25% but currently represents only 2% of your market. How do you respond?",
      options: [
        ["Allocate 10-15% of R&D budget to laser welding research while protecting the core business; create a 3-year roadmap to build capability before the market tips.", 4],
        ["Ignore laser welding — 2% market share is insignificant.", 0],
        ["Pivot the entire company to laser welding immediately.", 1],
        ["Acquire a small laser welding firm to buy the capability.", 3],
        ["Commission a study and revisit in 2 years.", 2],
      ],
    },
    {
      stem: "Your largest customer (18% of revenue) is pressuring you for a 12% price reduction. Your EBITDA margin is 14%. If you agree, you break even on their business. What is the most strategic response?",
      options: [
        ["Model the total cost of losing the customer (revenue, capacity utilisation, overhead absorption) vs the cost of the discount, then negotiate a value-based counter-proposal with process improvements that reduce their total cost of ownership.", 4],
        ["Accept the discount to keep the relationship.", 1],
        ["Refuse and risk losing them.", 2],
        ["Offer a 6% discount as a compromise.", 2],
        ["Agree but secretly reduce product quality to maintain margin.", 0],
      ],
    },
    {
      stem: "India's manufacturing sector is shifting toward automation. Your competitors are investing heavily. Your board asks whether D&H Secheron should follow. Your plant is profitable but labour-intensive. What do you recommend?",
      options: [
        ["Propose a phased automation strategy: automate high-volume, low-complexity lines first; reinvest savings into upskilling workers for higher-value operations; track ROI per phase before expanding.", 4],
        ["Recommend full automation across all lines within 2 years.", 1],
        ["Advise against automation — the plant is profitable as-is.", 0],
        ["Copy exactly what competitors are doing.", 1],
        ["Commission a consulting study before doing anything.", 2],
      ],
    },
    {
      stem: "Three growth opportunities are on the table: (A) expand into Southeast Asian markets (high risk, high return), (B) deepen penetration in existing Indian markets (low risk, moderate return), (C) launch a new product line for renewable energy (moderate risk, uncertain return). Budget allows two of three.",
      options: [
        ["Choose B and C — secure the base with Indian market depth while building a renewable energy position for the future; revisit SE Asia when the new product line proves out.", 4],
        ["Choose A and B — go for the highest combined return.", 3],
        ["Choose A and C — maximise risk for maximum reward.", 1],
        ["Do all three with reduced investment in each.", 1],
        ["Do only B — minimise risk entirely.", 0],
      ],
    },
    {
      stem: "Your company has been organised by function (sales, manufacturing, R&D) for 20 years. A new strategy requires faster cross-functional decision-making. What structural change would you recommend?",
      options: [
        ["Create product/market-focused business units with embedded sales, ops, and R&D teams; retain light functional centres for standards and knowledge sharing.", 4],
        ["Add more cross-functional meetings without changing the structure.", 1],
        ["Hire a Chief Strategy Officer to coordinate.", 2],
        ["Maintain the current structure — it has worked for 20 years.", 0],
        ["Implement a matrix structure with dual reporting.", 3],
      ],
    },
  ];

  return Array.from({ length: 30 }, (_, i) => {
    const s = scenarios[i % scenarios.length];
    return {
      created_by,
      item_options: s.options.map(([text, weight], oi) => ({
        display_order: oi + 1,
        option_text: text,
        score_weight: weight,
      })),
      item_type: "SCENARIO" as const,
      layer_code: "LEADERSHIP" as const,
      review_status: "APPROVED" as const,
      scoring_key: { audience: "SELF", model: "partial_credit_0_4" },
      stem: s.stem,
      sub_dimension_name: "Strategic thinking",
      tags: { audience: "SELF", role_family_usage: role_family_segments },
      time_limit_seconds: 120,
    };
  });
}

// ─── CHANGE LEADERSHIP (LEADERSHIP layer, SCENARIO format) ───────────────────

function build_change_leadership_items(created_by: string): SeedItem[] {
  const scenarios: Array<{
    stem: string;
    options: Array<[string, number]>;
  }> = [
    {
      stem: "You are implementing a new quality management system. 60% of your team is resistant — they see it as 'more paperwork.' How do you lead this change?",
      options: [
        ["Identify 2-3 respected team members as change champions, give them early access to demonstrate quick wins, then cascade adoption through peer influence rather than mandate.", 4],
        ["Make compliance mandatory with consequences for non-adoption.", 2],
        ["Delay the rollout until everyone is on board.", 0],
        ["Implement it silently and hope people adjust.", 1],
        ["Hold a town hall explaining why the change is important.", 2],
      ],
    },
    {
      stem: "Your company is consolidating two plants into one. Morale at the closing plant is collapsing. Production quality has dropped 15% in 3 weeks. What do you do?",
      options: [
        ["Acknowledge the uncertainty directly, communicate the transition timeline transparently, offer retention bonuses for key staff through the transition period, and set up weekly check-ins to address concerns.", 4],
        ["Focus on the receiving plant — the closing one is a sunk cost.", 0],
        ["Promise everyone will keep their jobs (even if not true) to stabilise morale.", 0],
        ["Bring in temporary staff to replace anyone who leaves early.", 2],
        ["Speed up the closure to reduce the period of uncertainty.", 1],
      ],
    },
    {
      stem: "Your leadership team is split 50/50 on a strategic pivot. Half want to invest in premium products, half want to protect the mass-market position. You need alignment before the board meeting in 2 weeks.",
      options: [
        ["Schedule individual conversations with each leader to understand their underlying concerns, identify common ground, then facilitate a structured session with data on both options to build a shared position.", 4],
        ["Make the call yourself — someone has to decide.", 2],
        ["Present both options to the board and let them decide.", 1],
        ["Delay the board meeting until the team agrees.", 0],
        ["Side with the majority and move forward.", 1],
      ],
    },
    {
      stem: "You have successfully piloted a lean manufacturing initiative in one line. Results are strong: 20% waste reduction, 15% throughput improvement. Now you need to scale it across 4 more lines with different team cultures.",
      options: [
        ["Adapt the approach for each line based on its specific culture and constraints; deploy the pilot team as coaches (not enforcers); celebrate early wins publicly; measure and share results transparently.", 4],
        ["Roll out the exact same playbook across all lines simultaneously.", 2],
        ["Let each line figure out how to implement lean on their own.", 1],
        ["Hire external consultants to manage the rollout.", 2],
        ["Wait for the other lines to ask for it.", 0],
      ],
    },
    {
      stem: "A major organisational restructuring has been announced. You learn through informal channels that key talent in your team is actively interviewing elsewhere. What do you do?",
      options: [
        ["Have honest one-on-one conversations with each person: acknowledge the uncertainty, share what you know, ask what they need to stay, and advocate upward for retention actions where warranted.", 4],
        ["Pretend you don't know they're interviewing.", 0],
        ["Immediately counter-offer with higher pay.", 2],
        ["Report them to HR for disloyalty.", 0],
        ["Start looking for replacements proactively.", 1],
      ],
    },
  ];

  return Array.from({ length: 30 }, (_, i) => {
    const s = scenarios[i % scenarios.length];
    return {
      created_by,
      item_options: s.options.map(([text, weight], oi) => ({
        display_order: oi + 1,
        option_text: text,
        score_weight: weight,
      })),
      item_type: "SCENARIO" as const,
      layer_code: "LEADERSHIP" as const,
      review_status: "APPROVED" as const,
      scoring_key: { audience: "SELF", model: "partial_credit_0_4" },
      stem: s.stem,
      sub_dimension_name: "Change leadership",
      tags: { audience: "SELF", role_family_usage: role_family_segments },
      time_limit_seconds: 120,
    };
  });
}

// ─── COMMERCIAL ACUMEN (SJT layer, SCENARIO format) ──────────────────────────

function build_commercial_acumen_items(created_by: string): SeedItem[] {
  const scenarios: Array<{
    stem: string;
    options: Array<[string, number]>;
  }> = [
    {
      stem: "A strategic customer demands a 15% price cut on their annual contract, threatening to switch to a Chinese competitor offering lower prices. Your product is technically superior but the price gap is real. How do you respond?",
      options: [
        ["Prepare a total-cost-of-ownership analysis showing that your higher quality reduces the customer's rework, warranty, and downtime costs; propose a value-sharing model where you lock in a 3-year deal with a smaller 5% reduction tied to volume commitments.", 4],
        ["Match the competitor's price to retain the account.", 1],
        ["Refuse any discount — your quality speaks for itself.", 1],
        ["Offer a 15% discount on the first year only as a retention tactic.", 2],
        ["Let the customer leave — you'll find a replacement.", 0],
      ],
    },
    {
      stem: "Your distributor in a new export market (Middle East) is underperforming — 40% below target after 6 months. However, they have strong local relationships and regulatory knowledge that would take 18 months to replicate.",
      options: [
        ["Set up a structured performance improvement plan with 90-day milestones; simultaneously begin discreet conversations with 1-2 backup distributors as contingency; share market intelligence and marketing support to help the current distributor succeed.", 4],
        ["Terminate the distributor and find a new one.", 1],
        ["Do nothing — 6 months isn't enough time to judge.", 0],
        ["Fly to the market and take over selling yourself.", 2],
        ["Reduce the distributor's territory as punishment.", 1],
      ],
    },
    {
      stem: "You discover a competitor is offering a product at 40% lower cost to your top 3 accounts. Initial testing shows their product is technically adequate but not superior. Two of the three accounts are considering switching.",
      options: [
        ["Conduct a rapid competitive analysis: test the competitor's product for failure modes, quantify the risk to the customer, then proactively visit all three accounts with data showing long-term cost of quality failures vs short-term price savings.", 4],
        ["Immediately match the competitor's price.", 1],
        ["Ignore it — customers will come back when the competitor fails.", 0],
        ["Lodge a complaint about dumping with industry regulators.", 1],
        ["Offer a bundled service package (product + support + training) that the competitor can't match.", 3],
      ],
    },
    {
      stem: "Your sales team consistently discounts 8-12% to close deals, even on products where you have a clear technical advantage and no close competitor. Margins are eroding quarter over quarter.",
      options: [
        ["Implement a deal-desk process: require discount justification above 5%, train the sales team on value selling (customer ROI, TCO, risk), and tie incentives to margin contribution not just revenue.", 4],
        ["Ban all discounting.", 1],
        ["Accept it — discounting is how industrial sales works in India.", 0],
        ["Fire the worst discounters.", 0],
        ["Raise list prices by 10% to absorb the discounting.", 2],
      ],
    },
    {
      stem: "A new government policy mandates that 30% of public infrastructure projects must use domestically manufactured welding consumables. Your capacity is at 85%. Your competitor has spare capacity.",
      options: [
        ["Model the demand impact, prioritise high-margin government contracts, negotiate longer lead times for lower-priority orders, and begin a phased capacity expansion tied to confirmed order pipeline.", 4],
        ["Accept all government orders and worry about capacity later.", 1],
        ["Ignore government orders — margins are lower than private sector.", 0],
        ["Immediately build a new production line.", 2],
        ["Subcontract overflow to a competitor.", 3],
      ],
    },
    {
      stem: "Your largest account's procurement manager is replaced. The new person is openly hostile to your company and favours a competitor they worked with previously. The annual contract renewal is in 3 months.",
      options: [
        ["Map the full decision-making unit (DMU): identify who else influences the decision (plant manager, quality head, CFO); strengthen those relationships with value-add engagements; ensure the new procurement manager receives outstanding service and data on your track record.", 4],
        ["Offer a larger discount to win the new person over.", 2],
        ["Go over their head to the CEO.", 1],
        ["Accept the loss and focus on other accounts.", 0],
        ["Wait and see if the new person comes around.", 0],
      ],
    },
  ];

  return Array.from({ length: 40 }, (_, i) => {
    const s = scenarios[i % scenarios.length];
    return {
      created_by,
      item_options: s.options.map(([text, weight], oi) => ({
        display_order: oi + 1,
        option_text: text,
        score_weight: weight,
      })),
      item_type: "SCENARIO" as const,
      layer_code: "SJT" as const,
      review_status: "APPROVED" as const,
      scoring_key: { model: "partial_credit_0_4", rationale_required: true },
      stem: s.stem,
      sub_dimension_name: "Commercial acumen",
      tags: { role_family_usage: role_family_segments, scenario_family: "commercial" },
      time_limit_seconds: 120,
    };
  });
}

// ─── Strategic thinking rater items (LEADERSHIP, LIKERT) ─────────────────────

function build_strategic_rater_items(created_by: string): SeedItem[] {
  const stems = [
    "This person connects day-to-day decisions to longer-term strategic goals.",
    "This person anticipates industry trends before they become obvious.",
    "This person identifies risks and opportunities that others miss.",
    "This person balances short-term results with long-term positioning.",
    "This person simplifies complex situations into clear strategic choices.",
    "This person adjusts strategy when new information contradicts prior assumptions.",
    "This person communicates a compelling vision that motivates action.",
    "This person makes resource allocation decisions based on strategic priority, not politics.",
    "This person recognises when a current approach is no longer working and pivots decisively.",
    "This person builds alliances across functions to advance strategic initiatives.",
  ];

  return stems.map((stem, i) => ({
    created_by,
    item_options: likert_options,
    item_type: "LIKERT" as const,
    layer_code: "LEADERSHIP" as const,
    review_status: "APPROVED" as const,
    scoring_key: { audience: "RATER" },
    stem,
    sub_dimension_name: "Strategic thinking",
    tags: { audience: "RATER", role_family_usage: role_family_segments },
    time_limit_seconds: 45,
  }));
}

function build_change_rater_items(created_by: string): SeedItem[] {
  const stems = [
    "This person leads change by example, not just by announcement.",
    "This person helps people understand why change is necessary.",
    "This person maintains team morale during periods of disruption.",
    "This person adapts the pace of change to the team's capacity to absorb it.",
    "This person identifies and activates change champions within the team.",
    "This person addresses resistance directly and constructively.",
    "This person follows through on change commitments rather than abandoning them under pressure.",
    "This person celebrates early wins to build momentum for larger changes.",
    "This person is transparent about what is known and unknown during transitions.",
    "This person protects team performance while managing change simultaneously.",
  ];

  return stems.map((stem, i) => ({
    created_by,
    item_options: likert_options,
    item_type: "LIKERT" as const,
    layer_code: "LEADERSHIP" as const,
    review_status: "APPROVED" as const,
    scoring_key: { audience: "RATER" },
    stem,
    sub_dimension_name: "Change leadership",
    tags: { audience: "RATER", role_family_usage: role_family_segments },
    time_limit_seconds: 45,
  }));
}

// ─── Public export ───────────────────────────────────────────────────────────

export function build_strategic_question_bank(created_by: string): SeedItem[] {
  return [
    ...build_learning_agility_items(created_by),      // 30 MCQ items (COGNITIVE)
    ...build_strategic_thinking_items(created_by),     // 30 SCENARIO items (LEADERSHIP)
    ...build_change_leadership_items(created_by),      // 30 SCENARIO items (LEADERSHIP)
    ...build_commercial_acumen_items(created_by),      // 40 SCENARIO items (SJT)
    ...build_strategic_rater_items(created_by),        // 10 LIKERT items (LEADERSHIP)
    ...build_change_rater_items(created_by),           // 10 LIKERT items (LEADERSHIP)
  ];
}
