import { RoleFamilyManager } from "@/components/role-family-manager";
import { require_roles } from "@/lib/auth/session";
import { get_role_family_manager_snapshot } from "@/lib/role-families";

export default async function RoleFamiliesPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);

  return <RoleFamilyManager initial_snapshot={await get_role_family_manager_snapshot(user.org_id)} />;
}
