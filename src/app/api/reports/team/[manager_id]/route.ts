import { NextRequest, NextResponse } from "next/server";
import { build_team_heatmap_view } from "@/lib/reporting-service";
import { get_request_session_user } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ manager_id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  try {
    const { manager_id } = await context.params;
    return NextResponse.json({
      heatmap: await build_team_heatmap_view({
        manager_id,
        viewer: user,
      }),
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to load team heatmap." }, { status: 400 });
  }
}
