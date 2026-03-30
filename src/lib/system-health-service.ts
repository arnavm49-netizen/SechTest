import { MonitorSeverity, MonitorStatus, Prisma, ScoringModelStatus, ValidityType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { as_array, as_number, as_record, as_string } from "@/lib/scoring/utils";

type MonitorComputation = {
  check_code: string;
  detail: string;
  metadata?: Record<string, unknown>;
  next_review_at: Date;
  severity: MonitorSeverity;
  status: MonitorStatus;
  title: string;
  trigger_summary?: string | null;
};

export async function get_system_health_snapshot(org_id: string) {
  await recompute_system_health_checks(org_id);

  const checks = await prisma.systemHealthCheck.findMany({
    where: {
      deleted_at: null,
      org_id,
    },
    orderBy: [{ severity: "desc" }, { title: "asc" }],
  });

  return {
    checks: checks.map((check) => ({
      check_code: check.check_code,
      checked_at: check.checked_at.toISOString(),
      detail: check.detail,
      next_review_at: check.next_review_at?.toISOString() ?? null,
      severity: check.severity,
      status: check.status,
      title: check.title,
      trigger_summary: check.trigger_summary,
    })),
  };
}

export async function recompute_system_health_checks(org_id: string) {
  const [role_families, live_model, assessments, kpi_definitions, outcome_records, adverse_impact_rows, criterion_rows, rater_assignments, scoring_runs] =
    await Promise.all([
      prisma.roleFamily.findMany({
        where: {
          deleted_at: null,
          org_id,
        },
      }),
      prisma.scoringModel.findFirst({
        where: {
          deleted_at: null,
          org_id,
          status: ScoringModelStatus.LIVE,
        },
        orderBy: [{ published_at: "desc" }],
      }),
      prisma.assessment.findMany({
        where: {
          deleted_at: null,
          org_id,
        },
        include: {
          scoring_runs: {
            where: { deleted_at: null },
            orderBy: { created_at: "desc" },
            take: 1,
            include: {
              scoring_model: true,
            },
          },
        },
      }),
      prisma.kpiDefinition.count({
        where: {
          deleted_at: null,
          org_id,
        },
      }),
      prisma.outcomeRecord.count({
        where: {
          deleted_at: null,
          assessment: {
            org_id,
          },
        },
      }),
      prisma.validityEvidence.findMany({
        where: {
          deleted_at: null,
          org_id,
          validity_type: ValidityType.ADVERSE_IMPACT,
        },
      }),
      prisma.validityEvidence.findMany({
        where: {
          deleted_at: null,
          org_id,
          validity_type: ValidityType.CRITERION,
        },
      }),
      prisma.raterAssignment.findMany({
        where: {
          deleted_at: null,
          assessment: {
            org_id,
          },
        },
      }),
      prisma.scoringRun.findMany({
        where: {
          deleted_at: null,
          assessment: {
            org_id,
          },
        },
        include: {
          scoring_model: true,
        },
      }),
    ]);

  const completed_assessments = assessments.filter((assessment) => assessment.status === "COMPLETED");
  const dropout_rate =
    assessments.length > 0
      ? assessments.filter((assessment) => assessment.status === "EXPIRED" || assessment.status === "INVALIDATED").length / assessments.length
      : 0;
  const average_duration_seconds =
    completed_assessments.reduce((sum, assessment) => sum + (assessment.total_time_seconds ?? 0), 0) / Math.max(completed_assessments.length, 1);
  const personality_overweight = role_families.filter((role_family) => {
    const matrix = as_record(role_family.weight_matrix) ?? {};
    return (as_number(matrix.PERSONALITY) ?? 0) > 30;
  });
  const criterion_personality_evidence = criterion_rows.filter((row) => row.layer_id !== null && row.metric_value >= 0.25);
  const ipsative_violation = scoring_runs.some((run) => {
    if (run.scoring_model.engine_mode !== "PHASE_A_CLASSICAL") {
      return false;
    }

    const permissible_use = as_record(as_record(run.step_outputs)?.permissible_use) ?? {};
    const excluded = as_array(permissible_use.excluded_layers).map((value) => as_string(value)).filter((value): value is string => Boolean(value));
    return !excluded.includes("PERSONALITY");
  });
  const recalibration_gap = live_model?.published_at ? Date.now() - live_model.published_at.getTime() > 730 * 24 * 60 * 60 * 1000 : true;
  const uncalibrated_360 = rater_assignments.some((assignment) => assignment.relationship !== "SELF" && !assignment.calibration_completed);
  const adverse_impact_missing = adverse_impact_rows.length === 0;
  const adverse_impact_breach = adverse_impact_rows.some((row) => !row.pass_fail);

  const checks: MonitorComputation[] = [
    {
      check_code: "OVER_RELIANCE_ON_PERSONALITY",
      detail:
        personality_overweight.length > 0 && criterion_personality_evidence.length === 0
          ? "One or more role families weight personality above 30% without proven criterion validity."
          : "Personality weighting is within the configured safe range or already backed by criterion evidence.",
      next_review_at: next_review_for("HIGH"),
      severity: "HIGH",
      status: personality_overweight.length > 0 && criterion_personality_evidence.length === 0 ? "BREACHED" : "HEALTHY",
      title: "Over-reliance on personality",
      trigger_summary: personality_overweight.length ? `${personality_overweight.length} role families exceed the safe personality weighting cap.` : null,
    },
    {
      check_code: "NO_INTERNAL_VALIDATION_LOOP",
      detail:
        kpi_definitions === 0 || outcome_records === 0
          ? "KPI linkage or outcome records are missing, so the internal validation loop is not yet closed."
          : "KPI linkage and outcome records are present for downstream validity analysis.",
      next_review_at: next_review_for("CRITICAL"),
      severity: "CRITICAL",
      status: kpi_definitions === 0 || outcome_records === 0 ? "BREACHED" : "HEALTHY",
      title: "No internal validation loop",
      trigger_summary: `${kpi_definitions} KPI definitions, ${outcome_records} linked outcome records`,
    },
    {
      check_code: "ASSESSMENT_FATIGUE",
      detail:
        average_duration_seconds > 5400 || dropout_rate > 0.15
          ? "Assessment duration or dropout rate is above the configured fatigue threshold."
          : "Assessment duration and dropout remain within the fatigue guardrails.",
      next_review_at: next_review_for("MEDIUM"),
      severity: "MEDIUM",
      status: average_duration_seconds > 5400 || dropout_rate > 0.15 ? "WARNING" : "HEALTHY",
      title: "Assessment fatigue",
      trigger_summary: `Average duration ${Math.round(average_duration_seconds / 60)} min, dropout ${(dropout_rate * 100).toFixed(1)}%`,
    },
    {
      check_code: "STATIC_SCORING_MODEL",
      detail: recalibration_gap
        ? "The live scoring model has not been refreshed inside the 24-month governance window."
        : "The live scoring model is inside the governance refresh window.",
      next_review_at: next_review_for("HIGH"),
      severity: "HIGH",
      status: recalibration_gap ? "WARNING" : "HEALTHY",
      title: "Static scoring model",
      trigger_summary: live_model?.published_at ? `Published ${live_model.published_at.toISOString()}` : "No live model published",
    },
    {
      check_code: "IPSATIVE_SCORING_ERROR",
      detail: ipsative_violation
        ? "A Phase A classical run appears to include personality in inter-person fit usage."
        : "Phase A runs continue to exclude personality from hiring fit, and Phase B supports normative comparison.",
      next_review_at: next_review_for("HIGH"),
      severity: "HIGH",
      status: ipsative_violation ? "BREACHED" : "HEALTHY",
      title: "Ipsative scoring error",
      trigger_summary: ipsative_violation ? "Review permissible-use enforcement immediately." : null,
    },
    {
      check_code: "POPULARITY_BIAS_360",
      detail: uncalibrated_360
        ? "At least one 360 assignment is active without rater calibration being marked complete."
        : "360 assignments are calibrated before release.",
      next_review_at: next_review_for("MEDIUM"),
      severity: "MEDIUM",
      status: uncalibrated_360 ? "WARNING" : "HEALTHY",
      title: "360 popularity bias",
      trigger_summary: `${rater_assignments.length} rater assignments tracked`,
    },
    {
      check_code: "ADVERSE_IMPACT_UNDETECTED",
      detail:
        adverse_impact_missing || adverse_impact_breach
          ? "Adverse-impact monitoring is missing or an existing selection-rate ratio is below the 4/5ths threshold."
          : "Adverse-impact monitoring is active and currently within threshold.",
      next_review_at: next_review_for("CRITICAL"),
      severity: "CRITICAL",
      status: adverse_impact_missing || adverse_impact_breach ? "BREACHED" : "HEALTHY",
      title: "Adverse impact monitoring",
      trigger_summary: adverse_impact_missing ? "No adverse-impact evidence stored yet" : `${adverse_impact_rows.length} evidence rows checked`,
    },
    {
      check_code: "NO_OUTCOME_LINKAGE",
      detail:
        outcome_records === 0 || criterion_rows.length === 0
          ? "Scores are not yet linked strongly enough to outcome evidence for decision-grade claims."
          : "Outcome linkage is present and criterion evidence can be inspected.",
      next_review_at: next_review_for("CRITICAL"),
      severity: "CRITICAL",
      status: outcome_records === 0 || criterion_rows.length === 0 ? "BREACHED" : "HEALTHY",
      title: "No outcome linkage",
      trigger_summary: `${outcome_records} outcome rows, ${criterion_rows.length} criterion evidence rows`,
    },
  ];

  for (const check of checks) {
    await prisma.systemHealthCheck.upsert({
      where: {
        org_id_check_code: {
          check_code: check.check_code,
          org_id,
        },
      },
      create: {
        check_code: check.check_code,
        checked_at: new Date(),
        detail: check.detail,
        metadata: to_json_input(check.metadata ?? {}),
        next_review_at: check.next_review_at,
        org_id,
        severity: check.severity,
        status: check.status,
        title: check.title,
        trigger_summary: check.trigger_summary ?? null,
      },
      update: {
        checked_at: new Date(),
        detail: check.detail,
        metadata: to_json_input(check.metadata ?? {}),
        next_review_at: check.next_review_at,
        severity: check.severity,
        status: check.status,
        title: check.title,
        trigger_summary: check.trigger_summary ?? null,
      },
    });
  }
}

function next_review_for(severity: MonitorSeverity) {
  const days = severity === "CRITICAL" ? 7 : severity === "HIGH" ? 30 : 90;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function to_json_input(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
