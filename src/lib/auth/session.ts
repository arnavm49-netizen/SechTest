import type { UserRole } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, verify_access_token } from "@/lib/auth/tokens";
import { get_role_home } from "@/lib/rbac";

export type SessionUser = {
  email: string;
  id: string;
  is_active: boolean;
  name: string;
  org_id: string;
  role: UserRole;
};

export async function get_session_user() {
  const cookie_store = await cookies();
  const token = cookie_store.get(ACCESS_COOKIE_NAME)?.value;
  return get_user_from_access_token(token);
}

export async function get_request_session_user(request: NextRequest) {
  return get_user_from_access_token(request.cookies.get(ACCESS_COOKIE_NAME)?.value);
}

export async function require_user() {
  const user = await get_session_user();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function require_roles(roles: UserRole[]) {
  const user = await require_user();

  if (!roles.includes(user.role)) {
    redirect(get_role_home(user.role));
  }

  return user;
}

export function apply_auth_cookies(
  response: NextResponse,
  input: { access_token: string; refresh_expires_at: Date; refresh_token: string },
) {
  response.cookies.set(ACCESS_COOKIE_NAME, input.access_token, {
    httpOnly: true,
    maxAge: 60 * 15,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  response.cookies.set(REFRESH_COOKIE_NAME, input.refresh_token, {
    expires: input.refresh_expires_at,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clear_auth_cookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  response.cookies.set(REFRESH_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function get_client_ip(source: Pick<NextRequest, "headers"> | Headers) {
  const headers = source instanceof Headers ? source : source.headers;
  const forwarded = headers.get("x-forwarded-for");
  const real_ip = headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }

  return real_ip ?? null;
}

async function get_user_from_access_token(token?: string) {
  if (!token) {
    return null;
  }

  try {
    const payload = await verify_access_token(token);

    if (!payload.sub) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        email: true,
        id: true,
        is_active: true,
        name: true,
        org_id: true,
        role: true,
      },
    });

    if (!user || !user.is_active) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
