import { AssessmentConfigurationManager } from "@/components/assessment-configuration-manager";
import { require_roles } from "@/lib/auth/session";
import { list_assessment_versions } from "@/lib/assessment-configuration";
import { prisma } from "@/lib/db";

export default async function AssessmentConfigurationPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);
  const [versions, role_families, layers] = await Promise.all([
    list_assessment_versions(user.org_id),
    prisma.roleFamily.findMany({
      where: {
        deleted_at: null,
        org_id: user.org_id,
      },
      orderBy: { name: "asc" },
    }),
    prisma.assessmentLayer.findMany({
      where: {
        deleted_at: null,
        is_active: true,
      },
      include: {
        _count: {
          select: {
            items: {
              where: {
                deleted_at: null,
                is_active: true,
                review_status: "APPROVED",
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AssessmentConfigurationManager
      initial_versions={versions}
      layers={layers.map((layer) => ({
        available_item_count: layer._count.items,
        code: layer.code,
        name: layer.name,
      }))}
      role_families={role_families.map((role_family) => ({
        id: role_family.id,
        name: role_family.name,
      }))}
    />
  );
}
