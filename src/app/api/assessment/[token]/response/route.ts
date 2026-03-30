import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hydrate_assessment_session, save_assessment_response } from "@/lib/assessment-runtime";

const response_schema = z.object({
  item_id: z.string().min(1),
  response_time_seconds: z.number().nonnegative(),
  response_value: z.any(),
  runtime_metadata: z.record(z.string(), z.unknown()).optional(),
  section_id: z.string().min(1),
  sequence_number: z.number().int().positive(),
});

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => null);
  const parsed = response_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid response payload." }, { status: 400 });
  }

  try {
    const { token } = await context.params;
    await save_assessment_response({
      invite_token: token,
      item_id: parsed.data.item_id,
      response_time_seconds: parsed.data.response_time_seconds,
      response_value: parsed.data.response_value,
      runtime_metadata: parsed.data.runtime_metadata,
      section_id: parsed.data.section_id,
      sequence_number: parsed.data.sequence_number,
    });

    const session = await hydrate_assessment_session(token);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to save response." }, { status: 400 });
  }
}
