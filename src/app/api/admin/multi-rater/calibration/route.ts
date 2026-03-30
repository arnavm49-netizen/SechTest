import { NextRequest, NextResponse } from "next/server";
import { get_request_session_user } from "@/lib/auth/session";
import { can_access_admin } from "@/lib/rbac";
import { get_multi_rater_snapshot, multi_rater_calibration_schema, update_rater_calibration } from "@/lib/multi-rater-service";

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = multi_rater_calibration_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide assignment ids for calibration tracking." }, { status: 400 });
  }

  await update_rater_calibration({
    assignment_ids: parsed.data.assignment_ids,
    calibration_completed: parsed.data.calibration_completed,
    org_id: user.org_id,
  });

  return NextResponse.json({ message: "Calibration status updated.", snapshot: await get_multi_rater_snapshot(user.org_id) });
}
