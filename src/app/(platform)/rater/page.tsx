import { RaterWorkspace } from "@/components/rater-workspace";
import { require_roles } from "@/lib/auth/session";
import { get_rater_workspace } from "@/lib/multi-rater-service";

export default async function RaterPage() {
  const user = await require_roles(["RATER"]);

  return <RaterWorkspace initial_workspace={await get_rater_workspace(user.id)} />;
}
