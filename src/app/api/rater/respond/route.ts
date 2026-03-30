import { NextRequest, NextResponse } from "next/server";
import { get_request_session_user } from "@/lib/auth/session";
import { rater_submission_schema, submit_rater_responses } from "@/lib/multi-rater-service";

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user || user.role !== "RATER") {
    return NextResponse.json({ message: "Rater authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = rater_submission_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid rater submission." }, { status: 400 });
  }

  try {
    const assignment = await submit_rater_responses(parsed.data);
    return NextResponse.json({ assignment });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to submit rater responses." }, { status: 400 });
  }
}
