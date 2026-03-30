import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import {
  create_draft_scoring_model,
  get_scoring_admin_snapshot,
  scoring_model_create_schema,
} from "@/lib/scoring-service";
import { can_access_admin } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const snapshot = await get_scoring_admin_snapshot(user.org_id);

  await log_audit_event({
    action: "API_REQUEST",
    ip_address: get_client_ip(request),
    metadata: { method: "GET", path: "/api/admin/scoring", status: 200 },
    target_entity: "scoring.admin_snapshot",
    user_id: user.id,
  });

  return NextResponse.json({ snapshot });
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
  const parsed = scoring_model_create_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid scoring model draft request." }, { status: 400 });
  }

  try {
    const model = await create_draft_scoring_model({
      actor_id: user.id,
      data: parsed.data,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "CHANGE_WEIGHT",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: "/api/admin/scoring", status: 201 },
      target_entity: "scoring_model",
      target_id: model.id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "Draft scoring model created.", model }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create a draft scoring model." },
      { status: 400 },
    );
  }
}
