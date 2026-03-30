import { ScoringManager } from "@/components/scoring-manager";
import { require_roles } from "@/lib/auth/session";
import { get_scoring_admin_snapshot } from "@/lib/scoring-service";

export default async function ScoringPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);
  const snapshot = await get_scoring_admin_snapshot(user.org_id);

  return <ScoringManager initial_snapshot={snapshot} />;
}
