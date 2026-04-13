import { UserManagement } from "@/components/user-management";
import { Badge } from "@/components/ui/badge";
import { require_roles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function AdminUsersPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);

  const users = await prisma.user.findMany({
    where: {
      deleted_at: null,
      org_id: user.org_id,
    },
    orderBy: [{ role: "asc" }, { created_at: "desc" }],
    select: {
      created_at: true,
      email: true,
      id: true,
      is_active: true,
      last_login: true,
      name: true,
      role: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">Users</Badge>
        <h1 className="text-4xl font-semibold">User Management</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Add new users, assign their roles, activate or deactivate accounts, and import users in bulk using a CSV file.
        </p>
      </div>

      <UserManagement
        current_user_role={user.role}
        initial_users={users.map((entry) => ({
          created_at: entry.created_at.toISOString(),
          email: entry.email,
          id: entry.id,
          is_active: entry.is_active,
          last_login: entry.last_login?.toISOString() ?? null,
          name: entry.name,
          role: entry.role,
        }))}
      />
    </div>
  );
}
