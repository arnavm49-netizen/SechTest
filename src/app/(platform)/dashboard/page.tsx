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
        <h1 className="text-4xl font-semibold">Operational launchpad</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          This dashboard is role-aware from day one. Super Admin and HR Admin land into configuration and governance, Managers land into
          team oversight, Assessors land into campaign operations, and Candidates and Raters are intentionally kept outside the admin shell.
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
            <CardTitle>Accessible workspaces</CardTitle>
            <CardDescription>These are the areas available to the current role in Step 1.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {can_access_admin(user.role) ? (
              <div className="rounded-[1.5rem] bg-brand-grey p-5">
                <p className="font-semibold">Admin shell</p>
                <p className="mt-2 text-sm leading-6 text-brand-black/70">
                  {admin_tabs.length} admin modules are now reachable, with User Management fully implemented in this phase.
                </p>
              </div>
            ) : null}
            {can_access_team(user.role) ? (
              <div className="rounded-[1.5rem] bg-brand-grey p-5">
                <p className="font-semibold">Team workspace</p>
                <p className="mt-2 text-sm leading-6 text-brand-black/70">
                  Managers receive a separate team-oriented surface instead of access to raw psychometric configuration.
                </p>
              </div>
            ) : null}
            {can_access_assessor_workspace(user.role) ? (
              <div className="rounded-[1.5rem] bg-brand-grey p-5">
                <p className="font-semibold">Assessor workspace</p>
                <p className="mt-2 text-sm leading-6 text-brand-black/70">
                  Assessors can work campaign and invite operations without receiving configuration-heavy admin access.
                </p>
              </div>
            ) : null}
            {user.role === "CANDIDATE" || user.role === "RATER" ? (
              <div className="rounded-[1.5rem] bg-brand-grey p-5">
                <p className="font-semibold">Restricted shell</p>
                <p className="mt-2 text-sm leading-6 text-brand-black/70">
                  Candidate and rater access is intentionally narrow in Step 1. They are excluded from admin pages entirely.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Illustrative weight warning</CardTitle>
            <CardDescription>Surface this warning early so no seeded defaults are mistaken for validated hiring logic.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[1.5rem] border border-brand-red/25 bg-brand-red/8 p-5 text-sm leading-7 text-brand-black/80">
              These weights are illustrative defaults. Override them with job-analysis-derived weights before any hiring decisions. A plant
              manager in welding consumables manufacturing has a fundamentally different cognitive-to-execution ratio than a cement key
              account manager.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
