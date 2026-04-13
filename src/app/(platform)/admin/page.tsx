import { Badge } from "@/components/ui/badge";
import { AdministeredTestLauncherCard } from "@/components/administered-test-launcher-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { require_roles } from "@/lib/auth/session";
import { list_assessment_versions } from "@/lib/assessment-configuration";
import { list_administered_tests } from "@/lib/administered-tests";
import { prisma } from "@/lib/db";
import { get_admin_tabs_for_role } from "@/lib/rbac";
import { format_date } from "@/lib/utils";

export default async function AdminPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);
  const tabs = get_admin_tabs_for_role(user.role);

  const [user_count, role_family_count, active_campaign_count, completed_assessment_count, recent_administered_tests, versions, role_families] = await Promise.all([
    prisma.user.count({ where: { org_id: user.org_id, deleted_at: null } }),
    prisma.roleFamily.count({ where: { org_id: user.org_id, deleted_at: null } }),
    prisma.campaign.count({ where: { org_id: user.org_id, deleted_at: null, status: "ACTIVE" } }),
    prisma.assessment.count({ where: { org_id: user.org_id, deleted_at: null, status: "COMPLETED" } }),
    list_administered_tests(user.org_id),
    list_assessment_versions(user.org_id),
    prisma.roleFamily.findMany({
      where: { org_id: user.org_id, deleted_at: null },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <Badge tone="red">Admin</Badge>
        <h1 className="text-4xl font-semibold">Admin Panel</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Launch assessments, manage roles and users, configure scoring, and generate test links. Everything stays connected and trackable
          in one place.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Users", value: user_count },
          { label: "Role families", value: role_family_count },
          { label: "Active campaigns", value: active_campaign_count },
          { label: "Completed assessments", value: completed_assessment_count },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="py-6">
              <p className="text-sm uppercase tracking-[0.18em] text-brand-black/55">{metric.label}</p>
              <p className="mt-3 text-4xl font-semibold">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <AdministeredTestLauncherCard
          description="Generate a candidate link directly from the operations panel. When the candidate opens it, the assessment and results stay recorded in the app database."
          role_families={role_families}
          title="Generate direct test link"
          versions={versions.map((version) => ({
            id: version.id,
            version_label: version.version_label,
          }))}
        />

        <Card>
          <CardHeader>
            <CardTitle>Recent direct links</CardTitle>
            <CardDescription>Direct invites are tracked here so you can verify what has been sent and what has already turned into a recorded assessment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent_administered_tests.slice(0, 5).map((entry) => (
              <div key={entry.id} className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey px-4 py-4">
                <p className="font-semibold text-brand-black">{entry.candidate_name}</p>
                <p className="text-sm text-brand-black/70">
                  {entry.role_family_name} · {entry.status} · {format_date(entry.created_at)}
                </p>
                <p className="mt-2 text-sm text-brand-black/70">
                  {entry.assessment_id ? `Recorded as assessment ${entry.assessment_id}` : "Assessment record will appear as soon as the candidate starts."}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All modules</CardTitle>
          <CardDescription>Questions, scoring, campaigns, reports, compliance, and more — all accessible from here.</CardDescription>
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
    </div>
  );
}
