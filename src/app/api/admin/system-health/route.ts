import { NextRequest, NextResponse } from "next/server";
import { get_request_session_user } from "@/lib/auth/session";
import { can_access_system_health } from "@/lib/rbac";
import { get_system_health_snapshot, recompute_system_health_checks } from "@/lib/system-health-service";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_system_health(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  return NextResponse.json({ snapshot: await get_system_health_snapshot(user.org_id) });
}

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_system_health(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  await recompute_system_health_checks(user.org_id);
  return NextResponse.json({ message: "System health checks recomputed.", snapshot: await get_system_health_snapshot(user.org_id) });
}
