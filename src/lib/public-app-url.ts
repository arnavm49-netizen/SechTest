import { env } from "@/lib/env";

function first_header_value(value?: string | null) {
  return value?.split(",")[0]?.trim() ?? null;
}

export function resolve_public_app_url(source?: Headers) {
  const host = first_header_value(source?.get("x-forwarded-host")) ?? first_header_value(source?.get("host"));
  const protocol = first_header_value(source?.get("x-forwarded-proto")) ?? (host?.includes("localhost") ? "http" : "https");

  if (host) {
    return `${protocol}://${host}`;
  }

  return env.APP_URL.replace(/\/$/, "");
}
