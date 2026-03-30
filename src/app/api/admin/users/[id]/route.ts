import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log_audit_event } from "@/lib/audit";
import { hash_password } from "@/lib/auth/password";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can_access_admin, can_manage_super_admins } from "@/lib/rbac";

const update_user_schema = z.object({
  email: z.string().email().optional(),
  is_active: z.boolean().optional(),
  name: z.string().min(2).optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "CANDIDATE", "RATER", "ASSESSOR"]).optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await get_request_session_user(request);
  const ip_address = get_client_ip(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const { id } = await context.params;
  const target_user = await prisma.user.findUnique({ where: { id } });

  if (!target_user || target_user.deleted_at || target_user.org_id !== user.org_id) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  if ((target_user.role === "SUPER_ADMIN" || target_user.id === user.id) && !can_manage_super_admins(user.role)) {
    return NextResponse.json({ message: "Only Super Admin can edit this user." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = update_user_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide valid user details." }, { status: 400 });
  }

  if (parsed.data.role === "SUPER_ADMIN" && !can_manage_super_admins(user.role)) {
    return NextResponse.json({ message: "Only Super Admin can assign the Super Admin role." }, { status: 403 });
  }

  if (parsed.data.is_active === false && target_user.id === user.id) {
    return NextResponse.json({ message: "You cannot deactivate your own account." }, { status: 400 });
  }

  const email = parsed.data.email?.trim().toLowerCase();

  if (email && email !== target_user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing && existing.id !== target_user.id && !existing.deleted_at) {
      return NextResponse.json({ message: "A user with that email already exists." }, { status: 409 });
    }
  }

  const update_data: Record<string, unknown> = {};

  if (parsed.data.name !== undefined) {
    update_data.name = parsed.data.name.trim();
  }

  if (email !== undefined) {
    update_data.email = email;
  }

  if (parsed.data.role !== undefined) {
    update_data.role = parsed.data.role;
  }

  if (parsed.data.is_active !== undefined) {
    update_data.is_active = parsed.data.is_active;
  }

  if (parsed.data.password) {
    update_data.password_hash = await hash_password(parsed.data.password);
  }

  if (Object.keys(update_data).length === 0) {
    return NextResponse.json({ message: "No valid changes were provided." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: target_user.id },
    data: update_data,
  });

  const action = parsed.data.is_active === false ? "DEACTIVATE_USER" : "UPDATE_USER";

  await log_audit_event({
    action,
    ip_address,
    metadata: {
      changed_fields: Object.keys(update_data),
      method: "PATCH",
      path: `/api/admin/users/${target_user.id}`,
    },
    target_entity: "user",
    target_id: target_user.id,
    user_id: user.id,
  });

  await log_audit_event({
    action: "API_REQUEST",
    ip_address,
    metadata: { method: "PATCH", path: `/api/admin/users/${target_user.id}`, status: 200 },
    target_entity: "admin.users",
    target_id: target_user.id,
    user_id: user.id,
  });

  return NextResponse.json({ message: "User updated successfully." });
}
