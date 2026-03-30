import { DevelopmentManager } from "@/components/development-manager";
import { require_roles } from "@/lib/auth/session";
import { get_development_snapshot } from "@/lib/development-service";

export default async function DevelopmentPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);

  return <DevelopmentManager initial_snapshot={await get_development_snapshot(user.org_id)} />;
}
