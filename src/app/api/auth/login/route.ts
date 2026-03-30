import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log_audit_event } from "@/lib/audit";
import { verify_password } from "@/lib/auth/password";
import { apply_auth_cookies, get_client_ip } from "@/lib/auth/session";
import {
  create_refresh_token,
  get_refresh_expiry,
  hash_refresh_token,
  issue_access_token,
} from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { enforce_rate_limit } from "@/lib/rate-limit";

const login_schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const ip_address = get_client_ip(request);
  const limit = enforce_rate_limit(`auth:login:${ip_address ?? "unknown"}`, 10, 60_000);

  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many login attempts. Please wait and try again." },
      {
        headers: { "Retry-After": String(limit.retry_after_seconds) },
        status: 429,
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = login_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid email and password." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.is_active) {
    return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
  }

  const is_valid_password = await verify_password(parsed.data.password, user.password_hash);

  if (!is_valid_password) {
    return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
  }

  const refresh_token = create_refresh_token();
  const refresh_expires_at = get_refresh_expiry();
  const access_token = await issue_access_token({
    email: user.email,
    id: user.id,
    name: user.name,
    org_id: user.org_id,
    role: user.role,
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        last_login: new Date(),
      },
    });

    await tx.refreshToken.create({
      data: {
        expires_at: refresh_expires_at,
        ip_address,
        token_hash: hash_refresh_token(refresh_token),
        user_agent: request.headers.get("user-agent"),
        user_id: user.id,
      },
    });
  });

  await log_audit_event({
    action: "LOGIN",
    ip_address,
    metadata: { method: "POST", path: "/api/auth/login", role: user.role },
    target_entity: "auth_session",
    target_id: user.id,
    user_id: user.id,
  });

  await log_audit_event({
    action: "API_REQUEST",
    ip_address,
    metadata: { method: "POST", path: "/api/auth/login", status: 200 },
    target_entity: "auth.login",
    target_id: user.id,
    user_id: user.id,
  });

  const response = NextResponse.json({
    message: "Login successful.",
    user: {
      email: user.email,
      id: user.id,
      name: user.name,
      role: user.role,
    },
  });

  apply_auth_cookies(response, {
    access_token,
    refresh_expires_at,
    refresh_token,
  });

  return response;
}
