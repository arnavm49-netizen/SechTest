import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { log_audit_event } from "@/lib/audit";
import { get_client_ip, get_request_session_user } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can_access_admin } from "@/lib/rbac";
import { ensure_default_report_templates, export_report_asset } from "@/lib/reporting-service";
import { run_scoring_for_assessment } from "@/lib/scoring-service";

type RouteContext = {
  params: Promise<{ assessment_id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const { assessment_id } = await context.params;
  const assessment = await prisma.assessment.findFirst({
    where: {
      deleted_at: null,
      id: assessment_id,
      org_id: user.org_id,
    },
    select: {
      candidate_id: true,
      id: true,
      org_id: true,
      quality_flags: true,
    },
  });

  if (!assessment) {
    return NextResponse.json({ message: "Assessment not found." }, { status: 404 });
  }

  try {
    await run_scoring_for_assessment({
      assessment_id: assessment.id,
      org_id: assessment.org_id,
    });

    // Clear any prior scoring-failure markers so the warning band disappears.
    const existing = Array.isArray(assessment.quality_flags)
      ? (assessment.quality_flags as Array<Record<string, unknown>>).filter(
          (entry) => entry && typeof entry === "object" && entry.scoring_failed !== true,
        )
      : [];

    await prisma.assessment.update({
      where: { id: assessment.id },
      data: { quality_flags: existing },
    });

    try {
      await ensure_default_report_templates(assessment.org_id);

      const viewer = {
        id: assessment.candidate_id,
        org_id: assessment.org_id,
        role: UserRole.SUPER_ADMIN,
      };

      await export_report_asset({
        actor_id: user.id,
        assessment_id: assessment.id,
        format: "pdf",
        report_type: "INDIVIDUAL",
        viewer,
      });

      await export_report_asset({
        actor_id: user.id,
        assessment_id: assessment.id,
        format: "pdf",
        report_type: "CANDIDATE_FEEDBACK",
        viewer,
      });
    } catch (report_error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Report pre-generation failed during rescore", report_error);
      }
    }

    await log_audit_event({
      action: "API_REQUEST",
      ip_address: get_client_ip(request),
      metadata: { method: "POST", path: `/api/admin/reports/${assessment.id}/rescore`, status: 200 },
      target_entity: "assessment",
      target_id: assessment.id,
      user_id: user.id,
    });

    return NextResponse.json({ message: "Assessment re-scored successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scoring error";

    // Persist the new error so the warning band updates with the latest cause.
    const existing = Array.isArray(assessment.quality_flags)
      ? (assessment.quality_flags as Array<Record<string, unknown>>).filter(
          (entry) => entry && typeof entry === "object" && entry.scoring_failed !== true,
        )
      : [];

    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        quality_flags: [
          ...existing,
          {
            scoring_failed: true,
            scoring_error: message,
            scoring_failed_at: new Date().toISOString(),
            reason: "scoring_failed",
          },
        ],
      },
    });

    return NextResponse.json({ message: `Re-scoring failed: ${message}` }, { status: 500 });
  }
}
