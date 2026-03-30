import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import {
  assessment_version_create_schema,
  create_draft_assessment_version,
  list_assessment_versions,
} from "@/lib/assessment-configuration";
import { can_access_admin } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const versions = await list_assessment_versions(user.org_id);

  await log_audit_event({
    action: "API_REQUEST",
    ip_address: get_client_ip(request),
    metadata: { method: "GET", path: "/api/admin/assessment-configuration", status: 200 },
    target_entity: "assessment_configuration",
    user_id: user.id,
  });

  return NextResponse.json({ versions });
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
  const parsed = assessment_version_create_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid draft source version." }, { status: 400 });
  }

  try {
    const version = await create_draft_assessment_version({
      actor_id: user.id,
      org_id: user.org_id,
      source_version_id: parsed.data.source_version_id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: "/api/admin/assessment-configuration", status: 201 },
      target_entity: "assessment_configuration.draft",
      target_id: version.id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "Draft assessment version created.", version }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create draft assessment version." },
      { status: 400 },
    );
  }
}
