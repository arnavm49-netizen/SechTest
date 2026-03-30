import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { assign_assessments_to_norm_group, norm_group_assignment_schema } from "@/lib/scoring-service";
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
  const parsed = norm_group_assignment_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide assessment ids to assign." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    await assign_assessments_to_norm_group({
      assessment_ids: parsed.data.assessment_ids,
      norm_group_id: id,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: `/api/admin/scoring/norm-groups/${id}/assign`, status: 200 },
      target_entity: "norm_group.assign",
      target_id: id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "Assessments assigned to norm group." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to assign assessments to the norm group." },
      { status: 400 },
    );
  }
}
