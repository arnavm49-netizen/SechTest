import { NextRequest, NextResponse } from "next/server";
import { build_individual_report_view } from "@/lib/reporting-service";
import { get_request_session_user } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ assessment_id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  try {
    const { assessment_id } = await context.params;
    return NextResponse.json({
      report: await build_individual_report_view({
        assessment_id,
        viewer: user,
      }),
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to load report." }, { status: 400 });
  }
}
