import { NextRequest, NextResponse } from "next/server";
import { get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import { compliance_settings_schema, get_compliance_snapshot, update_compliance_settings } from "@/lib/compliance-service";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  return NextResponse.json({ snapshot: await get_compliance_snapshot(user.org_id) });
}

export async function PUT(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = compliance_settings_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid compliance settings payload." }, { status: 400 });
  }

  await update_compliance_settings({
    data: parsed.data,
    org_id: user.org_id,
  });

  return NextResponse.json({ message: "Compliance settings updated.", snapshot: await get_compliance_snapshot(user.org_id) });
}
