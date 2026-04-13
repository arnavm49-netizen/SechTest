import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { require_user } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can_access_admin, can_access_assessor_workspace, can_access_team, get_admin_tabs_for_role } from "@/lib/rbac";
import { format_role_label } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await require_user();
  const admin_tabs = get_admin_tabs_for_role(user.role);

  const metrics = can_access_admin(user.role)
    ? await Promise.all([
        prisma.user.count({ where: { org_id: user.org_id, deleted_at: null } }),
        prisma.roleFamily.count({ where: { org_id: user.org_id, deleted_at: null } }),
        prisma.assessmentLayer.count({ where: { deleted_at: null } }),
        prisma.auditLog.count({ where: { deleted_at: null } }),
      ])
    : null;

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <Badge tone="red">{format_role_label(user.role)}</Badge>
        <h1 className="text-4xl font-semibold">Dashboard</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Your dashboard adapts to your role. Admins manage system settings and assessments, managers see team results, and assessors handle
          test delivery.
        </p>
      </section>

      {metrics ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Users", value: metrics[0] },
            { label: "Role families", value: metrics[1] },
            { label: "Assessment layers", value: metrics[2] },
            { label: "Audit events", value: metrics[3] },
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
            <CardTitle>Your workspaces</CardTitle>
            <CardDescription>These are the areas you can access based on your role.</CardDescription>
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
                  Send assessment links to candidates, track campaign progress, and monitor completions.
                </p>
              </a>
            ) : null}
            {user.role === "CANDIDATE" || user.role === "RATER" ? (
              <a className="block rounded-[1.5rem] bg-brand-grey p-5 transition hover:bg-brand-white" href="/candidate">
                <p className="font-semibold">My Assessments</p>
                <p className="mt-2 text-sm leading-6 text-brand-black/70">
                  View your feedback reports and submit data access or privacy requests.
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
