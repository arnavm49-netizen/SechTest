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

          // Auto-generate report record for the individual report template
          try {
            const individual_template = await prisma.reportTemplate.findFirst({
              where: {
                org_id: assessment.org_id,
                report_type: "INDIVIDUAL",
                is_active: true,
                deleted_at: null,
              },
            });

            if (individual_template) {
              await prisma.generatedReport.create({
                data: {
                  assessment_id: session.assessment.id,
                  report_template_id: individual_template.id,
                  file_url: `/api/reports/individual/${session.assessment.id}/pdf`,
                },
              });
            }

            // Also create candidate feedback report record
            const feedback_template = await prisma.reportTemplate.findFirst({
              where: {
                org_id: assessment.org_id,
                report_type: "CANDIDATE_FEEDBACK",
                is_active: true,
                deleted_at: null,
              },
            });

            if (feedback_template) {
              await prisma.generatedReport.create({
                data: {
                  assessment_id: session.assessment.id,
                  report_template_id: feedback_template.id,
                  file_url: `/api/reports/candidate-feedback/${session.assessment.id}/pdf`,
                },
              });
            }
          } catch {
            // Report record creation is non-critical — don't fail the completion
          }
        } catch (error) {
          scoring_status = "failed";
          if (process.env.NODE_ENV === "development") {
            console.error("Automatic scoring failed after assessment completion", error);
          }

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
