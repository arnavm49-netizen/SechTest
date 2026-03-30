import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { campaign_update_schema, update_campaign } from "@/lib/campaigns";
import { can_access_admin } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = campaign_update_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid campaign update payload." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const campaign = await update_campaign({
      campaign_id: id,
      data: parsed.data,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: { method: "PATCH", path: `/api/admin/campaigns/${id}`, status: 200 },
      target_entity: "campaign",
      target_id: campaign.id,
      user_id: user.id,
    });

    return NextResponse.json({ campaign, message: "Campaign updated." });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to update campaign." }, { status: 400 });
  }
}
