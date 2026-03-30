import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { publish_assessment_version } from "@/lib/assessment-configuration";
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

  try {
    const { id } = await context.params;
    const version = await publish_assessment_version({
      actor_id: user.id,
      org_id: user.org_id,
      version_id: id,
    });

    await log_audit_event({
      action: "PUBLISH_VERSION",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: `/api/admin/assessment-configuration/${id}/publish`, status: 200 },
      target_entity: "assessment_configuration.published",
      target_id: version.id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "Assessment version published.", version });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to publish assessment version." }, { status: 400 });
  }
}
