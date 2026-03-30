import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { clear_auth_cookies, get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { REFRESH_COOKIE_NAME, hash_refresh_token } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);
  const ip_address = get_client_ip(request);
  const raw_refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (raw_refresh_token) {
    await prisma.refreshToken.updateMany({
      where: {
        revoked_at: null,
        token_hash: hash_refresh_token(raw_refresh_token),
      },
      data: {
        revoked_at: new Date(),
      },
    });
  }

  if (user) {
    await log_audit_event({
      action: "LOGOUT",
      ip_address,
      metadata: { method: "POST", path: "/api/auth/logout" },
      target_entity: "auth_session",
      target_id: user.id,
      user_id: user.id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address,
      metadata: { method: "POST", path: "/api/auth/logout", status: 200 },
      target_entity: "auth.logout",
      target_id: user.id,
      user_id: user.id,
    });
  }

  const response = NextResponse.json({ message: "Logged out." });
  clear_auth_cookies(response);
  return response;
}
