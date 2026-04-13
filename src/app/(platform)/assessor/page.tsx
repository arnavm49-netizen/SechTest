import { AssessorWorkspace } from "@/components/assessor-workspace";
import { require_roles } from "@/lib/auth/session";
import { list_assessment_versions } from "@/lib/assessment-configuration";
import { list_administered_tests } from "@/lib/administered-tests";
import { list_campaigns } from "@/lib/campaigns";
import { prisma } from "@/lib/db";

export default async function AssessorPage() {
  const user = await require_roles(["ASSESSOR", "HR_ADMIN", "SUPER_ADMIN"]);
  const [campaigns, administered_tests, versions, role_families] = await Promise.all([
    list_campaigns(user.org_id),
    list_administered_tests(user.org_id),
    list_assessment_versions(user.org_id),
    prisma.roleFamily.findMany({
      where: {
        deleted_at: null,
        org_id: user.org_id,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return (
    <AssessorWorkspace
      administered_tests={administered_tests}
      campaigns={campaigns}
      role_families={role_families}
      versions={versions.map((version) => ({
        id: version.id,
        version_label: version.version_label,
      }))}
    />
  );
}
