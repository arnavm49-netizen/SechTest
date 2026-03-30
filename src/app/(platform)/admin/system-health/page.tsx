import { SystemHealthManager } from "@/components/system-health-manager";
import { require_roles } from "@/lib/auth/session";
import { get_system_health_snapshot } from "@/lib/system-health-service";

export default async function SystemHealthPage() {
  const user = await require_roles(["SUPER_ADMIN"]);

  return <SystemHealthManager initial_snapshot={await get_system_health_snapshot(user.org_id)} />;
}
