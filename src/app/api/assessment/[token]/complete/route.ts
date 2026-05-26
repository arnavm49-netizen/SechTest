import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { complete_assessment_from_invite } from "@/lib/assessment-runtime";
import { prisma } from "@/lib/db";
import { ensure_default_report_templates, export_report_asset } from "@/lib/reporting-service";
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
    let report_status: "success" | "failed" | "skipped" = "skipped";
    let report_error: string | null = null;

    if (session.assessment?.id) {
      const assessment = await prisma.assessment.findUnique({
        where: { id: session.assessment.id },
        select: { candidate_id: true, org_id: true, quality_flags: true },
      });

      if (assessment) {
        try {
          await run_scoring_for_assessment({
            assessment_id: session.assessment.id,
            org_id: assessment.org_id,
          });
          scoring_status = "success";

          try {
            await ensure_default_report_templates(assessment.org_id);

            const viewer = {
              id: assessment.candidate_id,
              org_id: assessment.org_id,
              role: UserRole.SUPER_ADMIN,
            };

            await export_report_asset({
              actor_id: null,
              assessment_id: session.assessment.id,
              format: "pdf",
              report_type: "INDIVIDUAL",
              viewer,
            });

            await export_report_asset({
              actor_id: null,
              assessment_id: session.assessment.id,
              format: "pdf",
              report_type: "CANDIDATE_FEEDBACK",
              viewer,
            });

            report_status = "success";
          } catch (error) {
            report_status = "failed";
            report_error = error instanceof Error ? error.message : "Unknown report error";
            if (process.env.NODE_ENV === "development") {
              console.error("Report pre-generation failed after assessment completion", error);
            }
          }
        } catch (error) {
          scoring_status = "failed";
          if (process.env.NODE_ENV === "development") {
            console.error("Automatic scoring failed after assessment completion", error);
          }

          const existing_flags = Array.isArray(assessment.quality_flags)
            ? (assessment.quality_flags as Array<Record<string, unknown>>).filter(
                (entry) => entry && typeof entry === "object" && entry.scoring_failed !== true,
              )
            : [];

          await prisma.assessment.update({
            where: { id: session.assessment.id },
            data: {
              quality_flags: [
                ...existing_flags,
                {
                  scoring_failed: true,
                  scoring_error: error instanceof Error ? error.message : "Unknown scoring error",
                  scoring_failed_at: new Date().toISOString(),
                  reason: "scoring_failed",
                },
              ],
            },
          });
        }
      }
    }

    return NextResponse.json({ scoring_status, report_status, report_error, session });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to complete assessment." }, { status: 400 });
  }
}
