import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { start_assessment_from_invite } from "@/lib/assessment-runtime";

const start_schema = z.object({
  runtime_metadata: z.record(z.string(), z.unknown()).optional(),
});

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const parsed = start_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid assessment start payload." }, { status: 400 });
  }

  try {
    const { token } = await context.params;
    const session = await start_assessment_from_invite({
      invite_token: token,
      runtime_metadata: parsed.data.runtime_metadata,
    });

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to start assessment." }, { status: 400 });
  }
}
