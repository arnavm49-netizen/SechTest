import { ValidityManager } from "@/components/validity-manager";
import { require_roles } from "@/lib/auth/session";
import { get_validity_dashboard_snapshot } from "@/lib/validity-service";

export default async function ValidityPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);

  return <ValidityManager initial_snapshot={await get_validity_dashboard_snapshot(user.org_id)} />;
}
