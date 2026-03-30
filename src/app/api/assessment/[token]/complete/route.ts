import { NextRequest, NextResponse } from "next/server";
import { complete_assessment_from_invite } from "@/lib/assessment-runtime";
import { prisma } from "@/lib/db";
import { run_scoring_for_assessment } from "@/lib/scoring-service";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const session = await complete_assessment_from_invite(token);

    if (session.assessment?.id) {
      const assessment = await prisma.assessment.findUnique({
        where: { id: session.assessment.id },
        select: { org_id: true },
      });

      if (assessment) {
        try {
          await run_scoring_for_assessment({
            assessment_id: session.assessment.id,
            org_id: assessment.org_id,
          });
        } catch (error) {
          console.error("Automatic scoring failed after assessment completion", error);
        }
      }
    }

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to complete assessment." }, { status: 400 });
  }
}
