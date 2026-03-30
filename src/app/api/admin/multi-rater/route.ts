import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import {
  create_multi_rater_cycle,
  get_multi_rater_snapshot,
  multi_rater_cycle_schema,
  multi_rater_settings_schema,
  update_multi_rater_settings,
} from "@/lib/multi-rater-service";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  return NextResponse.json({ snapshot: await get_multi_rater_snapshot(user.org_id) });
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
  const parsed = multi_rater_cycle_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid 360 assignment payload." }, { status: 400 });
  }

  try {
    await create_multi_rater_cycle({
      data: parsed.data,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: "/api/admin/multi-rater", status: 201 },
      target_entity: "multi_rater.assignment_cycle",
      target_id: parsed.data.assessment_id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "360 cycle created.", snapshot: await get_multi_rater_snapshot(user.org_id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create the 360 cycle." },
      { status: 400 },
    );
  }
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
  const parsed = multi_rater_settings_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid 360 configuration update." }, { status: 400 });
  }

  await update_multi_rater_settings({
    data: parsed.data,
    org_id: user.org_id,
  });

  return NextResponse.json({ message: "360 settings updated.", snapshot: await get_multi_rater_snapshot(user.org_id) });
}
