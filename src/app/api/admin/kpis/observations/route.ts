import { NextRequest, NextResponse } from "next/server";
import { get_request_session_user } from "@/lib/auth/session";
import { create_kpi_observation, get_kpi_dashboard_snapshot, kpi_observation_schema } from "@/lib/kpi-service";
import { can_access_admin } from "@/lib/rbac";

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = kpi_observation_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid KPI observation payload." }, { status: 400 });
  }

  await create_kpi_observation(parsed.data);

  return NextResponse.json({ message: "KPI observation recorded.", snapshot: await get_kpi_dashboard_snapshot(user.org_id) }, { status: 201 });
}
