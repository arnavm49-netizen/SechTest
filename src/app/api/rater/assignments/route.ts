import { NextRequest, NextResponse } from "next/server";
import { get_request_session_user } from "@/lib/auth/session";
import { get_rater_workspace } from "@/lib/multi-rater-service";

export async function GET(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user || user.role !== "RATER") {
    return NextResponse.json({ message: "Rater authentication required." }, { status: 401 });
  }

  return NextResponse.json({ workspace: await get_rater_workspace(user.id) });
}
