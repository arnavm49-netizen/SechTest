import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { create_norm_group, norm_group_create_schema } from "@/lib/scoring-service";
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
  const parsed = norm_group_create_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid norm group payload." }, { status: 400 });
  }

  try {
    const group = await create_norm_group({
      data: parsed.data,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: "/api/admin/scoring/norm-groups", status: 201 },
      target_entity: "norm_group",
      target_id: group.id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "Norm group created.", group }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create the norm group." },
      { status: 400 },
    );
  }
}
