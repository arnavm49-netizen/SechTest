import { NextRequest, NextResponse } from "next/server";
import { get_request_session_user } from "@/lib/auth/session";
import { kpi_definition_schema, create_kpi_definition, get_kpi_dashboard_snapshot } from "@/lib/kpi-service";
import { can_access_admin } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  return NextResponse.json({ snapshot: await get_kpi_dashboard_snapshot(user.org_id) });
}

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = kpi_definition_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid KPI definition payload." }, { status: 400 });
  }

  await create_kpi_definition({
    data: parsed.data,
    org_id: user.org_id,
  });

  return NextResponse.json({ message: "KPI definition created.", snapshot: await get_kpi_dashboard_snapshot(user.org_id) }, { status: 201 });
}
