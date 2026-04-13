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
      <div className="space-y-6">
        <section className="space-y-4">
          <Badge tone="red">Participant</Badge>
          <h1 className="text-4xl font-semibold">Welcome, {user.name.split(" ")[0]}</h1>
          <p className="max-w-4xl text-base leading-8 text-brand-black/70">
            This is your personal dashboard. View your assessment results, download feedback reports, and manage your account from here.
          </p>
        </section>

        {participant_metrics ? (
          <section className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="py-6">
                <p className="text-sm uppercase tracking-[0.18em] text-brand-black/55">Total assessments</p>
                <p className="mt-3 text-4xl font-semibold">{participant_metrics[0]}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6">
                <p className="text-sm uppercase tracking-[0.18em] text-brand-black/55">Completed</p>
                <p className="mt-3 text-4xl font-semibold">{participant_metrics[1]}</p>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <a className="block rounded-[1.5rem] border border-brand-black/10 bg-brand-white p-6 shadow-soft transition hover:border-brand-red/30" href="/candidate">
            <p className="text-lg font-semibold">My results & feedback</p>
            <p className="mt-2 text-sm leading-6 text-brand-black/70">
              View your completed assessments and download your personalised feedback reports.
            </p>
          </a>
          <div className="rounded-[1.5rem] border border-brand-black/10 bg-brand-white p-6 shadow-soft">
            <p className="text-lg font-semibold">Need help?</p>
            <p className="mt-2 text-sm leading-6 text-brand-black/70">
              If you have questions about your results or need to retake an assessment, please contact your HR administrator.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <Badge tone="red">Admin</Badge>
        <h1 className="text-4xl font-semibold">Dashboard</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Overview of your assessment platform. Manage users, send tests, and review results from here.
        </p>
      </section>

      {metrics ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Users", value: metrics[0] },
            { label: "Role families", value: metrics[1] },
            { label: "Completed assessments", value: metrics[2] },
            { label: "Active campaigns", value: metrics[3] },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="py-6">
                <p className="text-sm uppercase tracking-[0.18em] text-brand-black/55">{metric.label}</p>
                <p className="mt-3 text-4xl font-semibold">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Quick access</CardTitle>
            <CardDescription>Jump to the areas you use most.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {can_access_admin(user.role) ? (
              <a className="block rounded-[1.5rem] bg-brand-grey p-5 transition hover:bg-brand-white" href="/admin">
                <p className="font-semibold">Admin Panel</p>
                <p className="mt-2 text-sm leading-6 text-brand-black/70">
                  Access {admin_tabs.length} modules including user management, question bank, campaigns, reports, and more.
                </p>
              </a>
            ) : null}
            {can_access_team(user.role) ? (
              <a className="block rounded-[1.5rem] bg-brand-grey p-5 transition hover:bg-brand-white" href="/team">
                <p className="font-semibold">My Team</p>
                <p className="mt-2 text-sm leading-6 text-brand-black/70">
                  View your direct reports' assessment results, strengths, and development areas.
                </p>
              </a>
            ) : null}
            {can_access_assessor_workspace(user.role) ? (
              <a className="block rounded-[1.5rem] bg-brand-grey p-5 transition hover:bg-brand-white" href="/assessor">
                <p className="font-semibold">Test Delivery</p>
                <p className="mt-2 text-sm leading-6 text-brand-black/70">
                  Send assessment links to participants, track campaign progress, and monitor completions.
                </p>
              </a>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Important notice</CardTitle>
            <CardDescription>Please read before using assessment results for any decisions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[1.5rem] border border-brand-red/25 bg-brand-red/8 p-5 text-sm leading-7 text-brand-black/80">
              The current skill weights are placeholder defaults. Before using assessment results for hiring or promotion decisions, update
              them with weights from a proper job analysis. Different roles require different skill mixes — for example, a plant manager
              needs a very different profile compared to a key account manager.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
