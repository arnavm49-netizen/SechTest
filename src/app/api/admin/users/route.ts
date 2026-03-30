import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log_audit_event } from "@/lib/audit";
import { hash_password } from "@/lib/auth/password";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can_access_admin, can_manage_super_admins } from "@/lib/rbac";
import { enforce_rate_limit } from "@/lib/rate-limit";

const create_user_schema = z.object({
  email: z.string().email(),
  is_active: z.boolean().default(true),
  name: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "CANDIDATE", "RATER", "ASSESSOR"]),
});

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

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

  await log_audit_event({
    action: "API_REQUEST",
    ip_address: get_client_ip(request),
    metadata: { method: "GET", path: "/api/admin/users", status: 200 },
    target_entity: "admin.users",
    user_id: user.id,
  });

  return NextResponse.json({
    users: users.map((entry) => ({
      created_at: entry.created_at.toISOString(),
      email: entry.email,
      id: entry.id,
      is_active: entry.is_active,
      last_login: entry.last_login?.toISOString() ?? null,
      name: entry.name,
      role: entry.role,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);
  const ip_address = get_client_ip(request);
  const limit = enforce_rate_limit(`admin:create-user:${ip_address ?? "unknown"}`, 40, 60_000);

  if (!limit.allowed) {
    return NextResponse.json({ message: "Too many create requests. Try again shortly." }, { status: 429 });
  }

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = create_user_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide valid user details." }, { status: 400 });
  }

  if (parsed.data.role === "SUPER_ADMIN" && !can_manage_super_admins(user.role)) {
    return NextResponse.json({ message: "Only Super Admin can create another Super Admin." }, { status: 403 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && !existing.deleted_at) {
    return NextResponse.json({ message: "A user with that email already exists." }, { status: 409 });
  }

  const created_user = await prisma.user.create({
    data: {
      email,
      is_active: parsed.data.is_active,
      name: parsed.data.name.trim(),
      org_id: user.org_id,
      password_hash: await hash_password(parsed.data.password),
      role: parsed.data.role,
    },
  });

  await log_audit_event({
    action: "CREATE_USER",
    ip_address,
    metadata: {
      created_role: created_user.role,
      email: created_user.email,
      method: "POST",
      path: "/api/admin/users",
    },
    target_entity: "user",
    target_id: created_user.id,
    user_id: user.id,
  });

  await log_audit_event({
    action: "API_REQUEST",
    ip_address,
    metadata: { method: "POST", path: "/api/admin/users", status: 201 },
    target_entity: "admin.users",
    target_id: created_user.id,
    user_id: user.id,
  });

  return NextResponse.json({ message: "User created successfully." }, { status: 201 });
}
