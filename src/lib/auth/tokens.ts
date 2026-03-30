import { UserRole } from "@prisma/client";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { createHash, randomBytes } from "crypto";
import { env } from "@/lib/env";

export const ACCESS_COOKIE_NAME = "eps_access";
export const REFRESH_COOKIE_NAME = "eps_refresh";

const jwt_secret = new TextEncoder().encode(env.AUTH_SECRET);

export type SessionTokenPayload = JWTPayload & {
  email: string;
  name: string;
  org_id: string;
  role: UserRole;
};

export async function issue_access_token(user: {
  email: string;
  id: string;
  name: string;
  org_id: string;
  role: UserRole;
}) {
  return new SignJWT({
    email: user.email,
    name: user.name,
    org_id: user.org_id,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(jwt_secret);
}

export async function verify_access_token(token: string) {
  const result = await jwtVerify(token, jwt_secret);
  return result.payload as SessionTokenPayload;
}

export function create_refresh_token() {
  return randomBytes(48).toString("hex");
}

export function hash_refresh_token(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function get_refresh_expiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
