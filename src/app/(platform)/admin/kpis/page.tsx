import { KpiManager } from "@/components/kpi-manager";
import { require_roles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { get_kpi_dashboard_snapshot } from "@/lib/kpi-service";

export default async function KpiPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);
  const [snapshot, role_families, users] = await Promise.all([
    get_kpi_dashboard_snapshot(user.org_id),
    prisma.roleFamily.findMany({
      where: {
        deleted_at: null,
        org_id: user.org_id,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        org_id: user.org_id,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return <KpiManager initial_snapshot={snapshot} role_families={role_families} users={users} />;
}
