import { NextRequest, NextResponse } from "next/server";
import { hydrate_assessment_session } from "@/lib/assessment-runtime";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const session = await hydrate_assessment_session(token);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Invite not found." }, { status: 404 });
  }
}
