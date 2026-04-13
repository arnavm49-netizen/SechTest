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

    let scoring_status: "success" | "failed" | "skipped" = "skipped";

    if (session.assessment?.id) {
      const assessment = await prisma.assessment.findUnique({
        where: { id: session.assessment.id },
        select: { org_id: true, quality_flags: true },
      });

      if (assessment) {
        try {
          await run_scoring_for_assessment({
            assessment_id: session.assessment.id,
            org_id: assessment.org_id,
          });
          scoring_status = "success";
        } catch (error) {
          scoring_status = "failed";
          console.error("Automatic scoring failed after assessment completion", error);

          const existing_flags = (typeof assessment.quality_flags === "object" && assessment.quality_flags !== null)
            ? assessment.quality_flags as Record<string, unknown>
            : {};

          await prisma.assessment.update({
            where: { id: session.assessment.id },
            data: {
              quality_flags: {
                ...existing_flags,
                scoring_failed: true,
                scoring_error: error instanceof Error ? error.message : "Unknown scoring error",
                scoring_failed_at: new Date().toISOString(),
              },
            },
          });
        }
      }
    }

    return NextResponse.json({ scoring_status, session });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to complete assessment." }, { status: 400 });
  }
}
