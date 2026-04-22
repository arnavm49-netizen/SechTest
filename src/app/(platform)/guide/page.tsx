import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { require_user } from "@/lib/auth/session";
import { can_access_admin, can_access_assessor_workspace, can_access_team } from "@/lib/rbac";

const PARTICIPANT_ROLES = new Set(["CANDIDATE", "RATER"]);

export default async function GuidePage() {
  const user = await require_user();
  const is_admin = can_access_admin(user.role);
  const is_manager = can_access_team(user.role);
  const is_assessor = can_access_assessor_workspace(user.role);
  const is_participant = PARTICIPANT_ROLES.has(user.role);
  const is_rater = user.role === "RATER";

  return (
    <div className="space-y-10">
      <div>
        <Badge tone="neutral">Guide</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">How to use this platform</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-brand-black/50">
          Everything you need to know, based on your role. Scroll through or jump to any section.
        </p>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* PARTICIPANT GUIDE                                           */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(is_participant || is_admin) ? (
        <Section id="participant" title="For Participants" subtitle="If you are taking an assessment or viewing your results.">
          <Step number={1} title="Receiving your assessment link">
            <p>Your HR team will send you an email with a unique assessment link. Click it to open the assessment directly — no login required for the test itself.</p>
            <p>If you want to view your results later, log into this platform using the credentials your HR team provided.</p>
          </Step>

          <Step number={2} title="Starting the assessment">
            <p>When you open the link, you will see a landing page showing:</p>
            <ul>
              <li>The assessment name and your organisation</li>
              <li>The role family you are being assessed against</li>
              <li>Estimated completion time (typically 40–80 minutes)</li>
            </ul>
            <p>Click <strong>Begin assessment</strong> when you are ready. You can pause and resume later using the same link.</p>
          </Step>

          <Step number={3} title="Consent screen">
            <p>Before the assessment starts, you must accept the data usage consent. This explains how your responses will be used, stored, and who will have access. Read it carefully and click <strong>I agree and continue</strong>.</p>
          </Step>

          <Step number={4} title="Answering questions">
            <p>The assessment has multiple sections. Each section tests a different area:</p>
            <ul>
              <li><strong>Multiple choice</strong> — select the best answer</li>
              <li><strong>Rating scale</strong> — rate how much you agree with a statement (1–5)</li>
              <li><strong>Choose most &amp; least</strong> — drag statements into "Most Like Me" and "Least Like Me" slots</li>
              <li><strong>Card sorting</strong> — drag statements into importance categories</li>
              <li><strong>Situational scenarios</strong> — read a work situation and pick the best response</li>
            </ul>
            <p>Your responses are saved automatically after each question. A progress bar at the top shows how far you are.</p>
          </Step>

          <Step number={5} title="Breaks">
            <p>After certain sections, you may see a break screen. You can take a moment, close the tab, and return later using the same link. Your progress is saved.</p>
          </Step>

          <Step number={6} title="Completion">
            <p>After the last section, the assessment completes automatically. You will see a confirmation screen. HR will share your results once scoring and review are complete.</p>
          </Step>

          <Step number={7} title="Viewing your results">
            <p>Log into the platform and go to <strong>Home</strong>. You will see your completed assessments and can access your feedback report once HR has released it.</p>
            <p>The feedback report includes your overall fit score, key strengths, and development areas — but not raw scores or detailed psychometric data (those are only visible to HR).</p>
          </Step>

          <Tip>If you lose your assessment link or cannot remember your login credentials, contact your HR administrator.</Tip>
        </Section>
      ) : null}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* RATER GUIDE                                                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(is_rater || is_admin) ? (
        <Section id="rater" title="For 360 Reviewers" subtitle="If you have been asked to provide feedback on a colleague.">
          <Step number={1} title="Your assignments">
            <p>When you log in, you will see a list of people you have been asked to rate. Each assignment shows:</p>
            <ul>
              <li>The person's name and role family</li>
              <li>Your relationship (peer, direct report, or manager)</li>
              <li>Whether calibration is complete</li>
            </ul>
          </Step>

          <Step number={2} title="Completing ratings">
            <p>Select an assignment and rate each statement on a 1–5 scale:</p>
            <ul>
              <li><strong>1</strong> — Strongly disagree</li>
              <li><strong>2</strong> — Disagree</li>
              <li><strong>3</strong> — Neutral</li>
              <li><strong>4</strong> — Agree</li>
              <li><strong>5</strong> — Strongly agree</li>
            </ul>
            <p>Below each rating, there is an optional comment box. Use it to provide a specific example or observation that supports your rating. This narrative feedback is extremely valuable for development plans.</p>
          </Step>

          <Step number={3} title="Submitting">
            <p>Once you have rated all statements, click <strong>Submit 360 ratings</strong>. Your responses are anonymous to the person being rated (they see aggregated scores, not individual rater responses).</p>
          </Step>

          <Tip>Be honest and specific. Your feedback directly shapes the person's development plan. Generic ratings (all 4s) are not helpful.</Tip>
        </Section>
      ) : null}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MANAGER GUIDE                                               */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(is_manager || is_admin) ? (
        <Section id="manager" title="For Managers" subtitle="If you manage people who have been assessed.">
          <Step number={1} title="Team overview">
            <p>Go to <strong>My Team</strong> in the sidebar. You will see:</p>
            <ul>
              <li><strong>Summary metrics</strong> — how many assessments are completed, how many need attention</li>
              <li><strong>Team heatmap</strong> — colour-coded grid showing strengths and gaps across all your direct reports</li>
              <li><strong>9-Box Talent Grid</strong> — your team plotted on Performance (cognitive + execution + judgment) vs Potential (personality + leadership + motivators)</li>
            </ul>
          </Step>

          <Step number={2} title="Individual results">
            <p>Click any team member to see their details:</p>
            <ul>
              <li>Radar chart of scores across all assessment layers</li>
              <li>Key strengths (top 3 drivers)</li>
              <li>Development priorities (top gaps with scores)</li>
              <li>Role fit recommendation (Strong Fit, Fit, Develop, or Poor Fit)</li>
            </ul>
            <p><strong>Note:</strong> You see scores and recommendations but not the actual test responses. Individual answers stay private.</p>
          </Step>

          <Step number={3} title="Generating development plans">
            <p>For any team member, click <strong>Generate development plan</strong>. The system will:</p>
            <ul>
              <li>Identify their top 6 development gaps</li>
              <li>Create a structured plan with specific actions, success criteria, and timelines (typically 6–12 weeks per area)</li>
              <li>Prioritise high-stakes gaps first</li>
            </ul>
            <p>Review the plan with the employee and agree on priorities. Revisit at the midpoint and at the end of the timeline.</p>
          </Step>

          <Tip>The 9-box grid helps you see who your stars are (top-right) and who needs the most support (bottom-left). Use it for succession planning conversations with HR.</Tip>
        </Section>
      ) : null}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ASSESSOR GUIDE                                              */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(is_assessor || is_admin) ? (
        <Section id="assessor" title="For Assessors" subtitle="If you send test links and monitor campaign progress.">
          <Step number={1} title="Test delivery">
            <p>Go to <strong>Test Delivery</strong> in the sidebar. Here you can:</p>
            <ul>
              <li>Generate one-off assessment links for individual candidates</li>
              <li>Monitor which candidates have started, completed, or not yet begun their assessments</li>
              <li>Refresh the list to see real-time status</li>
            </ul>
          </Step>

          <Step number={2} title="Generating a direct link">
            <p>Fill in the candidate's name, email, and select the assessment version and role family. Click <strong>Generate link</strong>. Share the generated link with the candidate via email or message.</p>
          </Step>

          <Tip>Direct links are separate from campaign invitations. Use direct links for one-off assessments; use campaigns (managed by HR) for batch assessments.</Tip>
        </Section>
      ) : null}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ADMIN GUIDE                                                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      {is_admin ? (
        <Section id="admin" title="For HR Administrators" subtitle="Complete guide to managing the assessment platform.">

          <h3 className="mt-8 text-lg font-semibold tracking-tight text-brand-black">Getting Started</h3>
          <Step number={1} title="Understanding the assessment model">
            <p>The platform assesses candidates across 6 layers:</p>
            <ol>
              <li><strong>Cognitive</strong> — logical, numerical, verbal, abstract reasoning, and learning agility</li>
              <li><strong>Personality</strong> — Big Five traits plus Risk Appetite and Bias for Action</li>
              <li><strong>Motivators</strong> — what drives the person (money vs mastery, stability vs growth, etc.)</li>
              <li><strong>Execution</strong> — planning, prioritisation, closure, process discipline, attention to detail</li>
              <li><strong>Leadership</strong> — influence, conflict handling, delegation, strategic thinking, change leadership</li>
              <li><strong>Situational Judgment</strong> — applied decision-making in realistic scenarios including commercial acumen</li>
            </ol>
            <p>Each role family has a unique weight matrix that determines how much each layer contributes to the final fit score.</p>
          </Step>

          <h3 className="mt-8 text-lg font-semibold tracking-tight text-brand-black">Core Workflow</h3>
          <Step number={2} title="Setting up role families">
            <p>Go to <strong>Role Families</strong>. Each role family defines a job profile with:</p>
            <ul>
              <li>A description of the role</li>
              <li>A seniority level (Individual Contributor, First Line Manager, Middle Manager, Senior Leader, Executive)</li>
              <li>A weight matrix — percentages that add up to 100 across the 6 layers</li>
            </ul>
            <p>Example: A Plant Operations Manager might have Execution at 22% and Leadership at 18%, while a Graduate Trainee has Cognitive at 24% and Execution at 18%.</p>
            <Tip>Get the weights right before running assessments. They directly determine whether someone is rated as "Strong Fit" or "Develop."</Tip>
          </Step>

          <Step number={3} title="Building an assessment version">
            <p>Go to <strong>Assessment Builder</strong>. An assessment version defines which sections a candidate will see:</p>
            <ul>
              <li>Which layers are included (you can turn off layers)</li>
              <li>How many questions per section</li>
              <li>Which question types to use (multiple choice, scenarios, Likert, etc.)</li>
              <li>Time limits per section and for the total battery</li>
              <li>Whether to randomise questions</li>
              <li>Anti-gaming thresholds (flag rapid or patterned responses)</li>
            </ul>
            <p>Create a draft, configure it, then <strong>publish</strong> it. Only published versions can be used in campaigns.</p>
          </Step>

          <Step number={4} title="Creating a campaign">
            <p>Go to <strong>Campaigns</strong>. A campaign ties together an assessment version, a role family, and a group of candidates:</p>
            <ol>
              <li>Give the campaign a name (e.g., "Q2 2026 Plant Manager Hiring")</li>
              <li>Select the published assessment version</li>
              <li>Select the role family</li>
              <li>Choose the purpose: <strong>Hiring</strong>, <strong>Development</strong>, or <strong>Succession</strong></li>
              <li>Write an invitation message and a reminder message</li>
              <li>Set the status to Active</li>
            </ol>
          </Step>

          <Step number={5} title="Inviting candidates">
            <p>Inside a campaign, scroll down to the invitations section. You can:</p>
            <ul>
              <li>Select existing users from the candidate list</li>
              <li>Paste a list of email addresses for bulk invitations</li>
              <li>Set an expiry window (default: 14 days)</li>
            </ul>
            <p>Each candidate receives a unique assessment link. Track their progress in the invite list (Sent → Started → In Progress → Completed).</p>
          </Step>

          <Step number={6} title="Scoring and results">
            <p>Go to <strong>Scoring Setup</strong>. The system supports two scoring engines:</p>
            <ul>
              <li><strong>Classical</strong> — raw scores, z-scores, percentiles, 0–100 normalisation</li>
              <li><strong>Hybrid IRT</strong> — Item Response Theory for cognitive and Thurstonian models for personality</li>
            </ul>
            <p>After an assessment completes, scoring runs automatically. Each candidate gets:</p>
            <ul>
              <li>A fit score (0–100%) against their role family</li>
              <li>A recommendation: Strong Fit, Fit, Develop, or Poor Fit</li>
              <li>A 9-box placement (Performance × Potential)</li>
              <li>Top 3 strengths and top 2 development areas</li>
            </ul>
          </Step>

          <Step number={7} title="Viewing reports">
            <p>Go to <strong>Reports</strong>. Available report types:</p>
            <ul>
              <li><strong>Individual Psychometric Summary</strong> — full report with all scores, fit analysis, and development areas (HR only)</li>
              <li><strong>Candidate Feedback</strong> — simplified version for the candidate (strengths and growth areas, no raw scores)</li>
              <li><strong>Team Heatmap</strong> — colour-coded overview of a manager's team across all dimensions</li>
              <li><strong>Validity Evidence</strong> — traffic-light dashboard for construct, criterion, and fairness metrics</li>
              <li><strong>Adverse Impact</strong> — checks whether assessments disadvantage any demographic group</li>
            </ul>
            <p>Individual reports and PDFs are restricted to SUPER_ADMIN and HR_ADMIN roles. Managers see team-level data only.</p>
          </Step>

          <h3 className="mt-8 text-lg font-semibold tracking-tight text-brand-black">Advanced Features</h3>

          <Step number={8} title="360 feedback setup">
            <p>Go to <strong>360 Feedback Setup</strong>. For leadership development assessments:</p>
            <ol>
              <li>Select the subject (the person being assessed)</li>
              <li>Assign raters: self, peers, direct reports, and their manager</li>
              <li>Mark calibration as complete once raters understand the rating scale</li>
              <li>Raters log in to their own workspace and complete Likert ratings + optional narrative comments</li>
            </ol>
            <p>360 results feed into the scoring pipeline and appear in the individual report as blind-spot analysis (self vs others).</p>
          </Step>

          <Step number={9} title="Development plans">
            <p>Go to <strong>Development Plans</strong> to manage the recommendation library — these are the coaching suggestions that appear in development plans based on score bands.</p>
            <p>To generate a specific plan for someone, go to <strong>My Team</strong> (or ask the manager to do it) and click <strong>Generate development plan</strong> on their card. The system produces a structured plan with:</p>
            <ul>
              <li>Up to 6 prioritised interventions</li>
              <li>Specific actions per intervention (not generic advice)</li>
              <li>Success criteria and timelines (6–12 weeks each)</li>
              <li>A midpoint and final review date</li>
            </ul>
          </Step>

          <Step number={10} title="Question bank management">
            <p>Go to <strong>Question Bank</strong>. The bank contains ~1,050 questions across 9 types and 31 sub-dimensions. You can:</p>
            <ul>
              <li>Search and filter by layer, type, status, or sub-dimension</li>
              <li>View version history for any question</li>
              <li>Change review status (Draft → Reviewed → Approved → Retired)</li>
              <li>Import questions from CSV</li>
            </ul>
            <p>Only <strong>Approved</strong> questions are used in live assessments.</p>
          </Step>

          <Step number={11} title="Privacy and compliance">
            <p>Go to <strong>Privacy &amp; Audit</strong>. The platform is DPDP Act 2023 compliant:</p>
            <ul>
              <li>All candidates must consent before taking an assessment</li>
              <li>Candidates can request access to their data, challenge results, or request deletion</li>
              <li>All actions are logged in the audit trail</li>
              <li>Consent records include text, timestamp, and IP hash</li>
            </ul>
          </Step>

          <Tip>Before using assessment results for hiring or promotion decisions, ensure the weight matrices have been reviewed by someone who understands the role. The default weights are a starting point — not a final calibration.</Tip>
        </Section>
      ) : null}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* FAQ                                                         */}
      {/* ──────────────────────────────────────────────────────────── */}
      <Section id="faq" title="Frequently Asked Questions" subtitle="Common questions from all users.">
        <FAQ q="How long does the assessment take?">
          It depends on the version. The full foundation battery takes up to 80 minutes. The cognitive screener takes about 20 minutes. The graduate screening takes about 40 minutes. Your invitation email will mention the estimated time.
        </FAQ>
        <FAQ q="Can I pause and come back later?">
          Yes. Your progress is saved automatically after each question. Close the tab and re-open the same link to resume exactly where you left off.
        </FAQ>
        <FAQ q="Who sees my results?">
          Only HR administrators see the full psychometric report. Your manager sees a summary (fit score, strengths, and development areas) but not your individual answers. You see a simplified feedback report with your strengths and growth areas.
        </FAQ>
        <FAQ q="What happens if my connection drops during the assessment?">
          Your responses are saved after each question. Reopen the link to continue. If you experience repeated issues, contact your HR administrator.
        </FAQ>
        <FAQ q="Can I retake the assessment?">
          Only HR can authorise a retake by creating a new campaign invitation. The system tracks all attempts.
        </FAQ>
        <FAQ q="What does the 9-box grid mean?">
          The 9-box plots people on two axes: Performance (how well they execute and solve problems today) and Potential (their personality, leadership, and motivational traits that predict future growth). Top-right is highest performance + highest potential.
        </FAQ>
        <FAQ q="What is a 'role family'?">
          A role family is a job profile that defines what matters for that role. For example, a Plant Operations Manager needs strong execution (22%) and situational judgment (20%), while a Graduate Trainee needs strong cognitive ability (24%) and motivational fit (18%). The percentages determine how your scores are weighted.
        </FAQ>
        <FAQ q="What do the fit recommendations mean?">
          <strong>Strong Fit</strong> — scores align well with the role's requirements. <strong>Fit</strong> — generally aligned with some minor gaps. <strong>Develop</strong> — meaningful gaps that need development support. <strong>Poor Fit</strong> — significant misalignment with the role profile.
        </FAQ>
      </Section>
    </div>
  );
}

// ── Helper components ──

function Section({ children, id, title, subtitle }: { children: React.ReactNode; id: string; title: string; subtitle: string }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-brand-black">{title}</h2>
        <p className="mt-1 text-[13px] text-brand-black/50">{subtitle}</p>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
}

function Step({ children, number, title }: { children: React.ReactNode; number: number; title: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-black text-[12px] font-semibold text-brand-white">
            {number}
          </span>
          <CardTitle className="text-[15px]">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="prose-sm prose-brand-black/70 space-y-2 text-[13px] leading-relaxed text-brand-black/65 [&_strong]:text-brand-black [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1">
        {children}
      </CardContent>
    </Card>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900/80">
      <strong>Tip:</strong> {children}
    </div>
  );
}

function FAQ({ children, q }: { children: React.ReactNode; q: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">{q}</CardTitle>
      </CardHeader>
      <CardContent className="text-[13px] leading-relaxed text-brand-black/60 [&_strong]:text-brand-black">
        {children}
      </CardContent>
    </Card>
  );
}
