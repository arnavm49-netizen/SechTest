import { NextRequest, NextResponse } from "next/server";
import { export_report_asset } from "@/lib/reporting-service";
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
    const asset = await export_report_asset({
      actor_id: user.id,
      assessment_id,
      format: "pdf",
      report_type: "INDIVIDUAL",
      viewer: user,
    });

    return new NextResponse(asset.buffer, {
      headers: {
        "Content-Disposition": `attachment; filename=\"${asset.file_name}\"`,
        "Content-Type": asset.content_type,
      },
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to export report." }, { status: 400 });
  }
}
