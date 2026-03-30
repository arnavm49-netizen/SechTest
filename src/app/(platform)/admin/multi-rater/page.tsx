import { MultiRaterManager } from "@/components/multi-rater-manager";
import { require_roles } from "@/lib/auth/session";
import { get_multi_rater_snapshot } from "@/lib/multi-rater-service";

export default async function MultiRaterPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);

  return <MultiRaterManager initial_snapshot={await get_multi_rater_snapshot(user.org_id)} />;
}
