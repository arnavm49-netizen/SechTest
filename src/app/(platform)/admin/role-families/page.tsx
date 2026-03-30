import { PlaceholderModulePage } from "@/components/placeholder-module-page";
import { require_roles } from "@/lib/auth/session";

export default async function RoleFamiliesPage() {
  await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);

  return (
    <PlaceholderModulePage
      delivery_phase="Step 1 shell"
      summary="Role families are seeded in the database now; the advanced editing experience will expand from this scaffold in follow-on work."
      title="Role Family Manager"
    />
  );
}
