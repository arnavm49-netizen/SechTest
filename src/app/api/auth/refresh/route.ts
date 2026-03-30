import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { apply_auth_cookies, clear_auth_cookies, get_client_ip } from "@/lib/auth/session";
import {
  REFRESH_COOKIE_NAME,
  create_refresh_token,
  get_refresh_expiry,
  hash_refresh_token,
  issue_access_token,
} from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { enforce_rate_limit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip_address = get_client_ip(request);
  const limit = enforce_rate_limit(`auth:refresh:${ip_address ?? "unknown"}`, 20, 60_000);

  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many refresh attempts. Please wait and try again." },
      {
        headers: { "Retry-After": String(limit.retry_after_seconds) },
        status: 429,
      },
    );
  }

  const raw_refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!raw_refresh_token) {
    return NextResponse.json({ message: "Refresh token missing." }, { status: 401 });
  }

  const stored_token = await prisma.refreshToken.findUnique({
    where: {
      token_hash: hash_refresh_token(raw_refresh_token),
    },
    include: {
      user: true,
    },
  });

  if (!stored_token || stored_token.revoked_at || stored_token.expires_at <= new Date() || !stored_token.user.is_active) {
    const response = NextResponse.json({ message: "Refresh token is no longer valid." }, { status: 401 });
    clear_auth_cookies(response);
    return response;
  }

  const refresh_token = create_refresh_token();
  const refresh_expires_at = get_refresh_expiry();
  const access_token = await issue_access_token({
    email: stored_token.user.email,
    id: stored_token.user.id,
    name: stored_token.user.name,
    org_id: stored_token.user.org_id,
    role: stored_token.user.role,
  });

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: stored_token.id },
      data: { revoked_at: new Date() },
    });

    await tx.refreshToken.create({
      data: {
        expires_at: refresh_expires_at,
        ip_address,
        token_hash: hash_refresh_token(refresh_token),
        user_agent: request.headers.get("user-agent"),
        user_id: stored_token.user.id,
      },
    });
  });

  await log_audit_event({
    action: "TOKEN_REFRESH",
    ip_address,
    metadata: { method: "POST", path: "/api/auth/refresh" },
    target_entity: "auth_session",
    target_id: stored_token.user.id,
    user_id: stored_token.user.id,
  });

  await log_audit_event({
    action: "API_REQUEST",
    ip_address,
    metadata: { method: "POST", path: "/api/auth/refresh", status: 200 },
    target_entity: "auth.refresh",
    target_id: stored_token.user.id,
    user_id: stored_token.user.id,
  });

  const response = NextResponse.json({ message: "Token refreshed." });
  apply_auth_cookies(response, {
    access_token,
    refresh_expires_at,
    refresh_token,
  });
  return response;
}
