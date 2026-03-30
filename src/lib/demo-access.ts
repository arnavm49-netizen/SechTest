import { UserRole } from "@prisma/client";
import { hash_password } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

export const DEMO_SUPER_ADMIN_EMAIL = "superadmin@secheron.example.com";
export const DEMO_SUPER_ADMIN_NAME = "Aarav Kulkarni";
export const DEMO_PASSWORD = "Password@123";

export function is_demo_super_admin_credentials(email: string, password: string) {
  return email.trim().toLowerCase() === DEMO_SUPER_ADMIN_EMAIL && password === DEMO_PASSWORD;
}

export async function ensure_demo_super_admin(options: {
  org_id?: string;
  reset_password?: boolean;
} = {}) {
  const organization =
    options.org_id
      ? await prisma.organization.findUnique({
          where: { id: options.org_id },
        })
      : await prisma.organization.findFirst({
          where: { deleted_at: null },
          orderBy: [{ created_at: "asc" }],
        });

  if (!organization) {
    return null;
  }

  const password_hash = await hash_password(DEMO_PASSWORD);
  const existing_user = await prisma.user.findUnique({
    where: { email: DEMO_SUPER_ADMIN_EMAIL },
  });

  if (existing_user) {
    return prisma.user.update({
      where: { id: existing_user.id },
      data: {
        deleted_at: null,
        is_active: true,
        name: DEMO_SUPER_ADMIN_NAME,
        org_id: existing_user.org_id ?? organization.id,
        password_hash: options.reset_password === false ? existing_user.password_hash : password_hash,
        role: UserRole.SUPER_ADMIN,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: DEMO_SUPER_ADMIN_EMAIL,
      is_active: true,
      name: DEMO_SUPER_ADMIN_NAME,
      org_id: organization.id,
      password_hash,
      role: UserRole.SUPER_ADMIN,
    },
  });
}
