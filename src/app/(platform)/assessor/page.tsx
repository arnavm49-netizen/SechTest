import { PlaceholderModulePage } from "@/components/placeholder-module-page";
import { require_roles } from "@/lib/auth/session";

export default async function AssessorPage() {
  await require_roles(["ASSESSOR", "HR_ADMIN", "SUPER_ADMIN"]);

  return (
    <PlaceholderModulePage
      delivery_phase="Step 1 role shell"
      summary="Assessors and recruiters are separated from psychometric configuration and instead receive a narrower operating surface for campaigns, invites, and progress monitoring."
      title="Assessor Workspace"
    />
  );
}
