import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { campaign_invite_schema, create_campaign_invites } from "@/lib/campaigns";
import { can_access_admin } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = campaign_invite_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide valid invite details." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const result = await create_campaign_invites({
      campaign_id: id,
      data: parsed.data,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: { created_count: result.created_invites.length, method: "POST", path: `/api/admin/campaigns/${id}/invites`, status: 200 },
      target_entity: "campaign.invites",
      target_id: id,
      user_id: user.id,
    });

    return NextResponse.json({
      ...result,
      message: `Created ${result.created_invites.length} invite(s).`,
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to create campaign invites." }, { status: 400 });
  }
}
