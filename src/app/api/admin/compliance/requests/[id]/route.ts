import { NextRequest, NextResponse } from "next/server";
import { get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import { get_compliance_snapshot, governance_request_review_schema, review_governance_request } from "@/lib/compliance-service";

type RouteContext = {
  params: Promise<{ id: string }>;
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
  const parsed = governance_request_review_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid governance review payload." }, { status: 400 });
  }

  const { id } = await context.params;
  await review_governance_request({
    execute_delete: parsed.data.execute_delete,
    org_id: user.org_id,
    request_id: id,
    resolution_note: parsed.data.resolution_note,
    reviewer_id: user.id,
    status: parsed.data.status,
  });

  return NextResponse.json({ message: "Governance request updated.", snapshot: await get_compliance_snapshot(user.org_id) });
}
