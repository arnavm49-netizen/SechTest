import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hydrate_assessment_session, record_assessment_consent } from "@/lib/assessment-runtime";
import { get_client_ip } from "@/lib/auth/session";

const consent_schema = z.object({
  consent_text: z.string().min(10),
});

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => null);
  const parsed = consent_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Consent text is required." }, { status: 400 });
  }

  try {
    const { token } = await context.params;
    await record_assessment_consent({
      consent_text: parsed.data.consent_text,
      invite_token: token,
      ip_address: get_client_ip(request),
    });
    const session = await hydrate_assessment_session(token);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to record consent." }, { status: 400 });
  }
}
