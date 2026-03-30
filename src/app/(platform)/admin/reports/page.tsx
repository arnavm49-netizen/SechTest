import { ReportsManager } from "@/components/reports-manager";
import { require_roles } from "@/lib/auth/session";
import { get_reports_admin_snapshot } from "@/lib/reporting-service";

export default async function ReportsPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);

  return <ReportsManager initial_snapshot={await get_reports_admin_snapshot(user.org_id)} />;
}
