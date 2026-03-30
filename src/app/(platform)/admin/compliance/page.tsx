import { ComplianceManager } from "@/components/compliance-manager";
import { require_roles } from "@/lib/auth/session";
import { get_compliance_snapshot } from "@/lib/compliance-service";

export default async function CompliancePage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);

  return <ComplianceManager initial_snapshot={await get_compliance_snapshot(user.org_id)} />;
}
