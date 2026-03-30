import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { require_roles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { get_admin_tabs_for_role } from "@/lib/rbac";

export default async function AdminPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);
  const tabs = get_admin_tabs_for_role(user.role);

  const [user_count, role_family_count, report_template_count, audit_count] = await Promise.all([
    prisma.user.count({ where: { org_id: user.org_id, deleted_at: null } }),
    prisma.roleFamily.count({ where: { org_id: user.org_id, deleted_at: null } }),
    prisma.reportTemplate.count({ where: { org_id: user.org_id, deleted_at: null } }),
    prisma.auditLog.count({ where: { deleted_at: null } }),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <Badge tone="red">Admin shell</Badge>
        <h1 className="text-4xl font-semibold">Psychometric administration foundation</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Step 1 brings the configuration skeleton online so the rest of the phased build can plug into stable routes, permissions, and
          seeded metadata.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Users", value: user_count },
          { label: "Role families", value: role_family_count },
          { label: "Report templates", value: report_template_count },
          { label: "Audit events", value: audit_count },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="py-6">
              <p className="text-sm uppercase tracking-[0.18em] text-brand-black/55">{metric.label}</p>
              <p className="mt-3 text-4xl font-semibold">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Admin modules</CardTitle>
          <CardDescription>
            User Management is live in this phase. Every other module is intentionally scaffolded and permissioned for later build steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tabs.map((tab) => (
            <a className="rounded-[1.6rem] bg-brand-grey p-5 transition hover:bg-brand-white" href={tab.href} key={tab.href}>
              <p className="font-semibold">{tab.label}</p>
              <p className="mt-2 text-sm leading-6 text-brand-black/70">{tab.description}</p>
            </a>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default-weight warning</CardTitle>
          <CardDescription>Keep this visible until role-family weights are replaced with job-analysis-derived values.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[1.5rem] border border-brand-red/25 bg-brand-red/8 p-5 text-sm leading-7 text-brand-black/80">
            These weights are illustrative defaults. Override with job-analysis-derived weights before any hiring decisions.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
