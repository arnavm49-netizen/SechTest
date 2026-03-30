import { headers } from "next/headers";
import { AdministeredTestsManager } from "@/components/administered-tests-manager";
import { list_assessment_versions } from "@/lib/assessment-configuration";
import { list_administered_tests } from "@/lib/administered-tests";
import { require_roles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function AdministeredTestsPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);
  const request_headers = await headers();

  const [administered_tests, versions, role_families] = await Promise.all([
    list_administered_tests(user.org_id, request_headers),
    list_assessment_versions(user.org_id),
    prisma.roleFamily.findMany({
      where: {
        deleted_at: null,
        org_id: user.org_id,
      },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  return (
    <AdministeredTestsManager
      initial_administered_tests={administered_tests}
      role_families={role_families.map((role_family) => ({
        id: role_family.id,
        name: role_family.name,
      }))}
      versions={versions.map((version) => ({
        id: version.id,
        version_label: version.version_label,
      }))}
    />
  );
}
