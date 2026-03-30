import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { run_scoring_for_assessment, scoring_run_schema } from "@/lib/scoring-service";
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
  const parsed = scoring_run_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid scoring run request." }, { status: 400 });
  }

  try {
    const run = await run_scoring_for_assessment({
      assessment_id: parsed.data.assessment_id,
      model_id: parsed.data.model_id,
      org_id: user.org_id,
    });

    await log_audit_event({
      action: "VIEW_SCORE",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: "/api/admin/scoring/run", status: 200 },
      target_entity: "scoring_run",
      target_id: run.id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "Scoring run completed.", run });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to run scoring for this assessment." },
      { status: 400 },
    );
  }
}
