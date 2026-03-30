import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import { get_validity_dashboard_snapshot, recompute_validity_evidence, validity_compute_schema } from "@/lib/validity-service";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const snapshot = await get_validity_dashboard_snapshot(user.org_id);
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
  const parsed = validity_compute_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid validity recompute request." }, { status: 400 });
  }

  await recompute_validity_evidence({
    org_id: user.org_id,
    validity_type: parsed.data.validity_type,
  });

  await log_audit_event({
    action: "API_REQUEST",
    ip_address: get_client_ip(request),
    metadata: { method: "POST", path: "/api/admin/validity", status: 200, validity_type: parsed.data.validity_type ?? "ALL" },
    target_entity: "validity.recompute",
    user_id: user.id,
  });

  return NextResponse.json({
    message: "Validity evidence recomputed.",
    snapshot: await get_validity_dashboard_snapshot(user.org_id),
  });
}
