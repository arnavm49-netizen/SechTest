import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { campaign_create_schema, create_campaign, list_campaigns } from "@/lib/campaigns";
import { can_access_admin } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const campaigns = await list_campaigns(user.org_id);

  await log_audit_event({
    action: "API_REQUEST",
    ip_address: get_client_ip(request),
    metadata: { method: "GET", path: "/api/admin/campaigns", status: 200 },
    target_entity: "campaigns",
    user_id: user.id,
  });

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = campaign_create_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid campaign payload." }, { status: 400 });
  }

  try {
    const campaign = await create_campaign({
      actor_id: user.id,
      data: parsed.data,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: "/api/admin/campaigns", status: 201 },
      target_entity: "campaign",
      target_id: campaign.id,
      user_id: user.id,
    });

    return NextResponse.json({ campaign, message: "Campaign created." }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to create campaign." }, { status: 400 });
  }
}
