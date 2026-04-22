import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { require_user } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can_access_admin, can_access_assessor_workspace, can_access_team, get_admin_tabs_for_role } from "@/lib/rbac";

const PARTICIPANT_ROLES = new Set(["CANDIDATE", "RATER"]);

export default async function DashboardPage() {
  const user = await require_user();
  const admin_tabs = get_admin_tabs_for_role(user.role);
  const is_participant = PARTICIPANT_ROLES.has(user.role);

  const metrics = can_access_admin(user.role)
    ? await Promise.all([
        prisma.user.count({ where: { org_id: user.org_id, deleted_at: null } }),
        prisma.roleFamily.count({ where: { org_id: user.org_id, deleted_at: null } }),
        prisma.assessment.count({ where: { org_id: user.org_id, deleted_at: null, status: "COMPLETED" } }),
        prisma.campaign.count({ where: { org_id: user.org_id, deleted_at: null, status: "ACTIVE" } }),
      ])
    : null;

  const participant_metrics = is_participant
    ? await Promise.all([
        prisma.assessment.count({ where: { candidate_id: user.id, deleted_at: null } }),
        prisma.assessment.count({ where: { candidate_id: user.id, deleted_at: null, status: "COMPLETED" } }),
      ])
    : null;

  if (is_participant) {
    return (
      <div className="space-y-8">
        <div>
          <Badge tone="red">Participant</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Welcome, {user.name.split(" ")[0]}</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-brand-black/50">
            View your assessment results, download feedback reports, and manage your account.
          </p>
        </div>

        {participant_metrics ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Total assessments", value: participant_metrics[0] },
              { label: "Completed", value: participant_metrics[1] },
            ].map((m) => (
              <Card key={m.label}>
                <CardContent className="py-5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-brand-black/40">{m.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            className="group rounded-2xl border border-brand-black/[0.06] bg-brand-white p-5 shadow-card transition-all duration-200 hover:shadow-elevated"
            href="/candidate"
          >
            <p className="text-[14px] font-semibold text-brand-black group-hover:text-brand-red">My results &amp; feedback</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-brand-black/50">
              View completed assessments and download your personalised feedback reports.
            </p>
          </a>
          <div className="rounded-2xl border border-brand-black/[0.06] bg-brand-white p-5 shadow-card">
            <p className="text-[14px] font-semibold">Need help?</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-brand-black/50">
              Contact your HR administrator for questions about results or retaking an assessment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="red">Admin</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-brand-black/50">
          Overview of your assessment platform.
        </p>
      </div>

      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Users", value: metrics[0] },
            { label: "Role families", value: metrics[1] },
            { label: "Completed assessments", value: metrics[2] },
            { label: "Active campaigns", value: metrics[3] },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="py-5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-brand-black/40">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Quick access</CardTitle>
            <CardDescription>Jump to the areas you use most.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {can_access_admin(user.role) ? (
              <a
                className="group rounded-xl bg-brand-grey p-4 transition-colors duration-150 hover:bg-brand-grey-dark"
                href="/admin"
              >
                <p className="text-[13px] font-semibold group-hover:text-brand-red">Admin Panel</p>
                <p className="mt-1 text-[12px] leading-relaxed text-brand-black/50">
                  Access {admin_tabs.length} modules including user management, question bank, campaigns, and reports.
                </p>
              </a>
            ) : null}
            {can_access_team(user.role) ? (
              <a
                className="group rounded-xl bg-brand-grey p-4 transition-colors duration-150 hover:bg-brand-grey-dark"
                href="/team"
              >
                <p className="text-[13px] font-semibold group-hover:text-brand-red">My Team</p>
                <p className="mt-1 text-[12px] leading-relaxed text-brand-black/50">
                  View direct reports' assessment results, strengths, and development areas.
                </p>
              </a>
            ) : null}
            {can_access_assessor_workspace(user.role) ? (
              <a
                className="group rounded-xl bg-brand-grey p-4 transition-colors duration-150 hover:bg-brand-grey-dark"
                href="/assessor"
              >
                <p className="text-[13px] font-semibold group-hover:text-brand-red">Test Delivery</p>
                <p className="mt-1 text-[12px] leading-relaxed text-brand-black/50">
                  Send assessment links, track campaign progress, and monitor completions.
                </p>
              </a>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Important</CardTitle>
            <CardDescription>Read before using results for decisions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-900/80">
              Current skill weights are placeholder defaults. Before using assessment results for hiring or promotion
              decisions, update them with weights from a proper job analysis.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
