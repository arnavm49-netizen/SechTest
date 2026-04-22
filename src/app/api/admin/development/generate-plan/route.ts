import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { get_request_session_user } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { generate_development_plan } from "@/lib/development-plan-engine";
import { can_access_admin } from "@/lib/rbac";
import { build_individual_report_view } from "@/lib/reporting-service";

const generate_plan_schema = z.object({
  assessment_id: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const user = await get_request_session_user(request);

  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!can_access_admin(user.role)) {
    return NextResponse.json({ message: "You do not have access to this resource." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = generate_plan_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Please provide a valid assessment_id." }, { status: 400 });
  }

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: parsed.data.assessment_id,
      org_id: user.org_id,
      deleted_at: null,
      status: "COMPLETED",
    },
    include: {
      candidate: true,
      role_family: true,
      role_fit_results: true,
    },
  });

  if (!assessment) {
    return NextResponse.json({ message: "Assessment not found or not yet completed." }, { status: 404 });
  }

  const role_fit = assessment.role_fit_results[0];
  if (!role_fit) {
    return NextResponse.json({ message: "No role fit results found. Please run scoring first." }, { status: 400 });
  }

  // Build the report view to extract gap dimensions
  let report_view;
  try {
    report_view = await build_individual_report_view({
      assessment_id: assessment.id,
      viewer: user,
    });
  } catch {
    return NextResponse.json({ message: "Unable to build assessment report for plan generation." }, { status: 500 });
  }

  const gaps = (report_view.development_plan ?? []).map((dim) => ({
    sub_dimension_name: dim.sub_dimension_name,
    score_0_100: dim.score_0_100,
    layer_code: "",
    recommendation_texts: dim.recommendation_texts ?? [],
    high_stakes_gap: dim.high_stakes_gap ?? false,
  }));

  const plan_output = generate_development_plan({
    candidate_name: assessment.candidate.name,
    role_family_name: assessment.role_family.name,
    gaps,
    fit_score_pct: role_fit.fit_score_pct,
    recommendation: role_fit.recommendation,
  });

  // Persist the plan
  const dev_plan = await prisma.developmentPlan.create({
    data: {
      assessment_id: assessment.id,
      user_id: assessment.candidate_id,
      gap_dimensions: gaps as unknown as import("@prisma/client").Prisma.InputJsonValue,
      plan_summary: plan_output.plan_summary,
      status: "DRAFT",
      target_review_date: new Date(Date.now() + plan_output.target_review_date_weeks * 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Create interventions
  for (const intervention of plan_output.interventions) {
    await prisma.developmentIntervention.create({
      data: {
        development_plan_id: dev_plan.id,
        sub_dimension_name: intervention.sub_dimension_name,
        gap_score: intervention.gap_score,
        target_score: intervention.target_score,
        intervention_type: intervention.intervention_type,
        title: intervention.title,
        description: intervention.description,
        actions: intervention.actions as unknown as import("@prisma/client").Prisma.InputJsonValue,
        success_criteria: intervention.success_criteria,
        timeline_weeks: intervention.timeline_weeks,
        priority: intervention.priority,
      },
    });
  }

  // Re-fetch the full plan with interventions
  const full_plan = await prisma.developmentPlan.findUnique({
    where: { id: dev_plan.id },
    include: {
      interventions: {
        where: { deleted_at: null },
        orderBy: { priority: "asc" },
      },
    },
  });

  return NextResponse.json({
    message: "Development plan generated successfully.",
    plan: full_plan,
  }, { status: 201 });
}
