import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { update_assessment_heartbeat } from "@/lib/assessment-runtime";

const heartbeat_schema = z.object({
  runtime_metadata: z.record(z.string(), z.unknown()).optional(),
});

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const parsed = heartbeat_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid heartbeat payload." }, { status: 400 });
  }

  try {
    const { token } = await context.params;
    await update_assessment_heartbeat({
      invite_token: token,
      runtime_metadata: parsed.data.runtime_metadata,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to save progress heartbeat." }, { status: 400 });
  }
}
