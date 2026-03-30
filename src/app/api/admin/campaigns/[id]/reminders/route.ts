import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { campaign_reminder_schema, send_campaign_reminders } from "@/lib/campaigns";
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

  const body = await request.json().catch(() => ({}));
  const parsed = campaign_reminder_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide valid reminder targets." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const result = await send_campaign_reminders({
      campaign_id: id,
      invite_ids: parsed.data.invite_ids,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: `/api/admin/campaigns/${id}/reminders`, reminded_count: result.reminded_count, status: 200 },
      target_entity: "campaign.reminders",
      target_id: id,
      user_id: user.id,
    });

    return NextResponse.json({ message: `Reminders updated for ${result.reminded_count} invite(s).`, ...result });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to update reminders." }, { status: 400 });
  }
}
