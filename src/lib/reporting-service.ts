import { Prisma, ReportType, UserRole } from "@prisma/client";
import { PDFDocument as PdfDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { infer_tone_from_score } from "@/lib/insight-utils";
import { as_array, as_number, as_record, as_string, round_number } from "@/lib/scoring/utils";

export const report_template_update_schema = z.object({
  branding: z.record(z.string(), z.unknown()),
  distribution_rules: z.record(z.string(), z.unknown()),
  sections_config: z.any(),
});

export type ReportViewer = {
  id: string;
  org_id: string;
  role: UserRole;
};

type IndividualReportData = Awaited<ReturnType<typeof build_individual_report_view>>;
type CandidateFeedbackData = Awaited<ReturnType<typeof build_candidate_feedback_view>>;
type TeamHeatmapData = Awaited<ReturnType<typeof build_team_heatmap_view>>;

export async function get_reports_admin_snapshot(org_id: string) {
  const [templates, completed_assessments, managers] = await Promise.all([
    prisma.reportTemplate.findMany({
      where: {
        deleted_at: null,
        org_id,
      },
      orderBy: [{ report_type: "asc" }, { name: "asc" }],
    }),
    prisma.assessment.findMany({
      where: {
        deleted_at: null,
        org_id,
        status: "COMPLETED",
      },
      include: {
        candidate: {
          select: {
            email: true,
            id: true,
            manager: {
              select: {
                id: true,
                name: true,
              },
            },
            name: true,
          },
        },
        generated_reports: {
          where: { deleted_at: null },
          orderBy: { generated_at: "desc" },
          take: 4,
          include: {
            report_template: true,
          },
        },
        role_family: true,
        role_fit_results: {
          where: { deleted_at: null },
          orderBy: { created_at: "desc" },
          take: 1,
        },
        scoring_runs: {
          where: { deleted_at: null },
          orderBy: { created_at: "desc" },
          take: 1,
          include: {
            scoring_model: true,
          },
        },
      },
      orderBy: [{ completed_at: "desc" }],
      take: 30,
    }),
    prisma.user.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        org_id,
        role: "MANAGER",
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return {
    managers,
    recent_assessments: completed_assessments.map((assessment) => ({
      assessment_id: assessment.id,
      candidate_name: assessment.candidate.name,
      completed_at: assessment.completed_at?.toISOString() ?? null,
      latest_fit_score_pct: assessment.role_fit_results[0]?.fit_score_pct ?? null,
      latest_recommendation: assessment.role_fit_results[0]?.recommendation ?? null,
      latest_run_model_label: assessment.scoring_runs[0]?.scoring_model.version_label ?? null,
      manager_name: assessment.candidate.manager?.name ?? null,
      role_family_name: assessment.role_family.name,
      templates_generated: assessment.generated_reports.map((report) => ({
        generated_at: report.generated_at.toISOString(),
        report_type: report.report_template.report_type,
        template_name: report.report_template.name,
      })),
    })),
    templates: templates.map((template) => ({
      branding: as_record(template.branding) ?? {},
      distribution_rules: as_record(template.distribution_rules) ?? {},
      id: template.id,
      is_active: template.is_active,
      name: template.name,
      report_type: template.report_type,
      sections_config: template.sections_config,
    })),
  };
}

export async function update_report_template(input: {
  data: z.infer<typeof report_template_update_schema>;
  org_id: string;
  template_id: string;
}) {
  const template = await prisma.reportTemplate.findFirst({
    where: {
      deleted_at: null,
      id: input.template_id,
      org_id: input.org_id,
    },
  });

  if (!template) {
    throw new Error("Report template not found.");
  }

  const updated = await prisma.reportTemplate.update({
    where: { id: template.id },
    data: {
      branding: to_json_input(input.data.branding),
      distribution_rules: to_json_input(input.data.distribution_rules),
      sections_config: to_json_input(input.data.sections_config),
    },
  });

  return {
    branding: as_record(updated.branding) ?? {},
    distribution_rules: as_record(updated.distribution_rules) ?? {},
    id: updated.id,
    is_active: updated.is_active,
    name: updated.name,
    report_type: updated.report_type,
    sections_config: updated.sections_config,
  };
}

export async function build_individual_report_view(input: {
  assessment_id: string;
  viewer: ReportViewer;
}) {
  const assessment = await prisma.assessment.findFirst({
    where: {
      deleted_at: null,
      id: input.assessment_id,
      org_id: input.viewer.org_id,
    },
    include: {
      candidate: {
        include: {
          manager: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      development_plans: {
        where: { deleted_at: null },
        orderBy: { created_at: "desc" },
        take: 1,
      },
      generated_reports: {
        where: { deleted_at: null },
        orderBy: { generated_at: "desc" },
        take: 10,
        include: {
          report_template: true,
        },
      },
      role_family: true,
      role_fit_results: {
        where: { deleted_at: null },
        orderBy: { created_at: "desc" },
        take: 1,
      },
      scoring_runs: {
        where: { deleted_at: null },
        orderBy: { created_at: "desc" },
        take: 1,
        include: {
          scoring_model: true,
        },
      },
      scores: {
        where: {
          deleted_at: null,
          sub_dimension_id: null,
        },
        include: {
          assessment_layer: true,
        },
        orderBy: {
          assessment_layer: {
            name: "asc",
          },
        },
      },
    },
  });

  if (!assessment) {
    throw new Error("Assessment report not found.");
  }

  assert_report_access(input.viewer, assessment.candidate_id, assessment.candidate.manager_id);

  const latest_run = assessment.scoring_runs[0] ?? null;
  const latest_fit = assessment.role_fit_results[0] ?? null;
  const step_outputs = as_record(latest_run?.step_outputs) ?? {};
  const indices = as_record(step_outputs.indices) ?? {};
  const role_fit = as_record(step_outputs.role_fit) ?? {};
  const development_plan = assessment.development_plans[0]
    ? as_array(as_record(assessment.development_plans[0].gap_dimensions)?.gaps ?? assessment.development_plans[0].gap_dimensions)
    : [];
  const layer_scores = as_array(step_outputs.layer_scores).map((entry) => as_record(entry)).filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const behaviour_maps = await get_behaviour_maps_for_assessment(input.assessment_id);
  const blind_spot_gaps = await get_blind_spot_gaps(input.assessment_id, assessment.candidate_id);

  return {
    assessment: {
      assessment_id: assessment.id,
      candidate_name: assessment.candidate.name,
      completed_at: assessment.completed_at?.toISOString() ?? null,
      created_at: assessment.created_at.toISOString(),
      manager_name: assessment.candidate.manager?.name ?? null,
      recommendation: latest_fit?.recommendation ?? null,
      role_family_name: assessment.role_family.name,
      status: assessment.status,
    },
    behaviour_maps,
    blind_spot_gaps,
    development_plan: development_plan.map((entry) => {
      const gap = as_record(entry) ?? {};
      return {
        high_stakes_gap: gap.high_stakes_gap === true,
        percentile: as_number(gap.percentile),
        recommendation_texts: as_array(gap.recommendation_texts).map((value) => as_string(value)).filter((value): value is string => Boolean(value)),
        score_0_100: as_number(gap.score_0_100) ?? null,
        sub_dimension_name: as_string(gap.sub_dimension_name) ?? "Unknown",
      };
    }),
    fit: {
      fit_score_pct: latest_fit?.fit_score_pct ?? null,
      recommendation: latest_fit?.recommendation ?? null,
      top_constraints: as_array(role_fit.top_2_constraints).map(serialize_driver),
      top_drivers: as_array(role_fit.top_3_drivers).map(serialize_driver),
    },
    generated_reports: assessment.generated_reports.map((report) => ({
      generated_at: report.generated_at.toISOString(),
      report_type: report.report_template.report_type,
      template_name: report.report_template.name,
    })),
    layer_scores: layer_scores.map((entry) => ({
      explanation: as_string(entry.explanation) ?? "",
      included_in_role_fit: entry.included_in_role_fit === true,
      label: as_string(entry.layer_code)?.replaceAll("_", " ") ?? "Unknown",
      layer_code: as_string(entry.layer_code) ?? "UNKNOWN",
      score_0_100: as_number(entry.normalized_score_0_100) ?? as_number(entry.raw_score) ?? 0,
      tone: infer_tone_from_score(as_number(entry.normalized_score_0_100) ?? as_number(entry.raw_score) ?? null),
    })),
    motivation_archetype: as_array(indices.motivation_archetype).map((entry) => {
      const archetype = as_record(entry) ?? {};
      return {
        archetype: as_string(archetype.archetype) ?? "Unknown",
        score_0_100: as_number(archetype.score_0_100) ?? 0,
      };
    }),
    personality_vector: as_array(indices.personality_vector).map((entry) => {
      const trait = as_record(entry) ?? {};
      return {
        percentile: as_number(trait.percentile) ?? null,
        score_0_10: round_number((as_number(trait.score_0_100) ?? 0) / 10, 2),
        sub_dimension_name: as_string(trait.sub_dimension_name) ?? "Unknown",
      };
    }),
    report_model: latest_run?.scoring_model.version_label ?? null,
    role_fit_rank_in_cohort: latest_fit?.rank_in_cohort ?? null,
    template: await get_active_template(assessment.org_id, "INDIVIDUAL"),
  };
}

export async function build_candidate_feedback_view(input: {
  assessment_id: string;
  viewer: ReportViewer;
}) {
  const report = await build_individual_report_view(input);
  const candidate_feedback_enabled = Boolean((await get_org_settings(input.viewer.org_id)).candidate_feedback_enabled);

  if (input.viewer.role === "CANDIDATE" && !candidate_feedback_enabled) {
    throw new Error("Candidate feedback is disabled for this organisation.");
  }

  return {
    assessment: report.assessment,
    development_areas: report.development_plan.slice(0, 3),
    feedback_indicator: simplify_recommendation(report.fit.recommendation),
    learning_resources: report.behaviour_maps.slice(0, 4).map((entry) => ({
      behaviour: entry.behaviour_description,
      focus_area: entry.sub_dimension_name,
      outcome: entry.outcome_description,
    })),
    strengths: report.layer_scores.filter((score) => score.score_0_100 >= 65).slice(0, 3),
    template: await get_active_template(input.viewer.org_id, "CANDIDATE_FEEDBACK"),
  };
}

export async function build_team_heatmap_view(input: {
  manager_id?: string | null;
  viewer: ReportViewer;
}) {
  const target_manager_id = input.viewer.role === "MANAGER" ? input.viewer.id : input.manager_id ?? null;
  const candidate_filter =
    input.viewer.role === "MANAGER" || target_manager_id
      ? {
          candidate: {
            manager_id: target_manager_id ?? input.viewer.id,
          },
        }
      : {};
  const assessments = await prisma.assessment.findMany({
    where: {
      deleted_at: null,
      org_id: input.viewer.org_id,
      status: "COMPLETED",
      ...candidate_filter,
    },
    include: {
      candidate: {
        select: {
          id: true,
          manager: {
            select: {
              name: true,
            },
          },
          name: true,
        },
      },
      role_family: true,
      role_fit_results: {
        where: { deleted_at: null },
        orderBy: { created_at: "desc" },
        take: 1,
      },
      scores: {
        where: {
          deleted_at: null,
          sub_dimension_id: {
            not: null,
          },
        },
        include: {
          sub_dimension: true,
        },
      },
    },
    orderBy: [{ completed_at: "desc" }],
  });

  const latest_by_candidate = new Map<string, (typeof assessments)[number]>();

  for (const assessment of assessments) {
    if (!latest_by_candidate.has(assessment.candidate.id)) {
      latest_by_candidate.set(assessment.candidate.id, assessment);
    }
  }

  const rows = Array.from(latest_by_candidate.values());
  const sub_dimension_names = Array.from(
    new Set(
      rows.flatMap((assessment) =>
        assessment.scores.map((score) => score.sub_dimension?.name).filter((value): value is string => Boolean(value)),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return {
    rows: rows.map((assessment) => {
      const score_lookup = new Map(
        assessment.scores
          .map((score) => [score.sub_dimension?.name, score.normalized_score_0_100 ?? score.raw_score ?? null] as const)
          .filter((entry): entry is readonly [string, number | null] => Boolean(entry[0])),
      );

      return {
        candidate_name: assessment.candidate.name,
        fit_score_pct: assessment.role_fit_results[0]?.fit_score_pct ?? null,
        manager_name: assessment.candidate.manager?.name ?? null,
        recommendation: assessment.role_fit_results[0]?.recommendation ?? null,
        role_family_name: assessment.role_family.name,
        scores: sub_dimension_names.map((name) => {
          const score = score_lookup.get(name) ?? null;
          return {
            score,
            sub_dimension_name: name,
            tone: infer_tone_from_score(score),
          };
        }),
      };
    }),
    sub_dimensions: sub_dimension_names,
    summary: {
      assessment_count: rows.length,
      manager_name:
        target_manager_id
          ? rows[0]?.candidate.manager?.name ?? null
          : input.viewer.role === "MANAGER"
            ? null
            : "All teams",
      high_risk_cells: rows.reduce(
        (sum, assessment) =>
          sum +
          assessment.scores.filter((score) => (score.normalized_score_0_100 ?? score.raw_score ?? 0) < 40).length,
        0,
      ),
      strong_fit_count: rows.filter((assessment) => assessment.role_fit_results[0]?.recommendation === "STRONG_FIT").length,
    },
    template: await get_active_template(input.viewer.org_id, "TEAM_HEATMAP"),
  };
}

export async function export_report_asset(input: {
  actor_id?: string | null;
  assessment_id: string;
  format: "pdf" | "xlsx";
  manager_id?: string | null;
  report_type: "CANDIDATE_FEEDBACK" | "INDIVIDUAL" | "TEAM_HEATMAP";
  viewer: ReportViewer;
}) {
  if (input.report_type === "TEAM_HEATMAP") {
    const heatmap = await build_team_heatmap_view({
      manager_id: input.manager_id,
      viewer: input.viewer,
    });
    const workbook = build_team_heatmap_workbook(heatmap);
    return {
      buffer: workbook,
      content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      file_name: "team-heatmap.xlsx",
    };
  }

  const report =
    input.report_type === "CANDIDATE_FEEDBACK"
      ? await build_candidate_feedback_view({
          assessment_id: input.assessment_id,
          viewer: input.viewer,
        })
      : await build_individual_report_view({
          assessment_id: input.assessment_id,
          viewer: input.viewer,
        });
  const template = await get_active_template(input.viewer.org_id, input.report_type);
  const pdf_buffer = await build_pdf_buffer(
    input.report_type === "CANDIDATE_FEEDBACK" ? "Candidate Feedback Report" : "Individual Assessment Report",
    report,
    template?.branding ?? {},
  );

  if (template) {
    await prisma.generatedReport.create({
      data: {
        assessment_id: input.assessment_id,
        file_url:
          input.report_type === "CANDIDATE_FEEDBACK"
            ? `/api/reports/candidate-feedback/${input.assessment_id}/pdf`
            : `/api/reports/individual/${input.assessment_id}/pdf`,
        generated_by: input.actor_id ?? null,
        report_template_id: template.id,
      },
    });
  }

  return {
    buffer: pdf_buffer,
    content_type: "application/pdf",
    file_name: input.report_type === "CANDIDATE_FEEDBACK" ? "candidate-feedback.pdf" : "individual-report.pdf",
  };
}

async function get_active_template(org_id: string, report_type: ReportType) {
  const template =
    (await prisma.reportTemplate.findFirst({
      where: {
        deleted_at: null,
        is_active: true,
        org_id,
        report_type,
      },
      orderBy: { updated_at: "desc" },
    })) ??
    null;

  if (!template) {
    return null;
  }

  return {
    branding: as_record(template.branding) ?? {},
    distribution_rules: as_record(template.distribution_rules) ?? {},
    id: template.id,
    name: template.name,
    report_type: template.report_type,
    sections_config: template.sections_config,
  };
}

async function get_org_settings(org_id: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: org_id },
    select: {
      settings: true,
    },
  });

  return as_record(organization?.settings) ?? {};
}

async function get_behaviour_maps_for_assessment(assessment_id: string) {
  const scores = await prisma.score.findMany({
    where: {
      assessment_id,
      deleted_at: null,
      sub_dimension_id: {
        not: null,
      },
    },
    include: {
      sub_dimension: {
        include: {
          behaviour_maps: {
            where: {
              deleted_at: null,
              is_active: true,
            },
            orderBy: { created_at: "asc" },
            take: 1,
          },
        },
      },
    },
  });

  return scores
    .map((score) => ({
      behaviour_description: score.sub_dimension?.behaviour_maps[0]?.behaviour_description ?? "",
      outcome_description: score.sub_dimension?.behaviour_maps[0]?.outcome_description ?? "",
      score_0_100: score.normalized_score_0_100 ?? score.raw_score ?? null,
      sub_dimension_name: score.sub_dimension?.name ?? "Unknown",
    }))
    .filter((entry) => entry.behaviour_description.length > 0)
    .sort((left, right) => (left.score_0_100 ?? 0) - (right.score_0_100 ?? 0));
}

async function get_blind_spot_gaps(assessment_id: string, subject_id: string) {
  const [self_scores, rater_responses] = await Promise.all([
    prisma.score.findMany({
      where: {
        assessment_id,
        deleted_at: null,
        sub_dimension_id: {
          not: null,
        },
        assessment_layer: {
          code: "LEADERSHIP",
        },
      },
      include: {
        sub_dimension: true,
      },
    }),
    prisma.raterResponse.findMany({
      where: {
        deleted_at: null,
        rater_assignment: {
          deleted_at: null,
          subject_id,
          status: "COMPLETED",
        },
      },
      include: {
        item: {
          include: {
            sub_dimension: true,
          },
        },
        rater_assignment: true,
      },
    }),
  ]);
  const response_groups = new Map<string, number[]>();

  for (const response of rater_responses) {
    const sub_dimension_name = response.item.sub_dimension?.name;
    const rating = typeof response.response_value === "number" ? response.response_value : null;

    if (!sub_dimension_name || rating === null) {
      continue;
    }

    response_groups.set(sub_dimension_name, [...(response_groups.get(sub_dimension_name) ?? []), rating]);
  }

  return self_scores
    .map((score) => {
      const sub_dimension_name = score.sub_dimension?.name ?? "Unknown";
      const peer_scores = response_groups.get(sub_dimension_name) ?? [];
      const peer_average =
        peer_scores.length > 0 ? round_number(peer_scores.reduce((sum, value) => sum + value, 0) / peer_scores.length, 2) : null;
      const peer_average_100 = peer_average !== null ? round_number(((peer_average - 1) / 4) * 100, 2) : null;
      const gap = peer_average_100 !== null ? round_number((score.normalized_score_0_100 ?? score.raw_score ?? 0) - peer_average_100, 2) : null;

      return {
        blind_spot_flag: gap !== null && gap > 30,
        peer_average_100,
        self_score_100: score.normalized_score_0_100 ?? score.raw_score ?? 0,
        sub_dimension_name,
      };
    })
    .filter((entry) => entry.peer_average_100 !== null)
    .sort((left, right) => Number(right.blind_spot_flag) - Number(left.blind_spot_flag));
}

function build_team_heatmap_workbook(heatmap: TeamHeatmapData) {
  const worksheet = XLSX.utils.json_to_sheet(
    heatmap.rows.map((row) => ({
      candidate_name: row.candidate_name,
      fit_score_pct: row.fit_score_pct,
      recommendation: row.recommendation,
      role_family_name: row.role_family_name,
      ...Object.fromEntries(row.scores.map((score) => [score.sub_dimension_name, score.score])),
    })),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Team Heatmap");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

async function build_pdf_buffer(title: string, payload: CandidateFeedbackData | IndividualReportData, branding: Record<string, unknown>) {
  const pdf = await PdfDocument.create();
  const title_font = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const body_font = await pdf.embedFont(StandardFonts.TimesRoman);
  const accent = parse_hex_color(as_string(branding.accent_color) ?? "#ed3338");
  const primary = parse_hex_color(as_string(branding.primary_text) ?? "#000000");
  const page_size: [number, number] = [612, 792];
  const margin_left = 48;
  const margin_top = 48;
  const margin_bottom = 48;
  const content_width = page_size[0] - margin_left * 2;

  let page = pdf.addPage(page_size);
  let y = page_size[1] - margin_top;

  const ensure_space = (required_height: number) => {
    if (y - required_height >= margin_bottom) {
      return;
    }

    page = pdf.addPage(page_size);
    y = page_size[1] - margin_top;
  };

  const draw_paragraph = (text: string, options?: { color?: ReturnType<typeof rgb>; font?: typeof body_font; size?: number }) => {
    const size = options?.size ?? 10;
    const font = options?.font ?? body_font;
    const color = options?.color ?? primary;
    const lines = wrap_text(text, font, size, content_width);

    ensure_space(lines.length * (size + 4) + 6);

    for (const line of lines) {
      page.drawText(line, {
        color,
        font,
        size,
        x: margin_left,
        y,
      });
      y -= size + 4;
    }

    y -= 6;
  };

  draw_paragraph(title, { font: title_font, size: 20 });
  draw_paragraph(payload.assessment.candidate_name, { color: accent, font: title_font, size: 12 });

  if (is_candidate_feedback_payload(payload)) {
    draw_paragraph(`Overall fit indicator: ${payload.feedback_indicator}`, { font: title_font, size: 12 });
    draw_paragraph("Strength areas", { font: title_font, size: 12 });
    for (const entry of payload.strengths) {
      draw_paragraph(`- ${entry.label}`);
    }
    draw_paragraph("Development areas", { font: title_font, size: 12 });
    for (const entry of payload.development_areas) {
      draw_paragraph(`- ${entry.sub_dimension_name}`);
    }
  } else {
    if (payload.fit.fit_score_pct !== null) {
      draw_paragraph(`Role fit score: ${payload.fit.fit_score_pct}%`, { font: title_font, size: 12 });
    }
    draw_paragraph(`Recommendation: ${payload.fit.recommendation ?? "Pending"}`);
    draw_paragraph("Layer summary", { font: title_font, size: 12 });
    for (const score of payload.layer_scores) {
      draw_paragraph(`${score.label}: ${score.score_0_100} / 100`);
    }

    if (payload.fit.top_drivers.length) {
      draw_paragraph("Top drivers", { font: title_font, size: 12 });
      for (const driver of payload.fit.top_drivers) {
        draw_paragraph(`- ${driver.label}: ${driver.weighted_contribution ?? "n/a"}`);
      }
    }

    if (payload.development_plan.length) {
      draw_paragraph("Development priorities", { font: title_font, size: 12 });
      for (const gap of payload.development_plan.slice(0, 4)) {
        draw_paragraph(`- ${gap.sub_dimension_name}: ${gap.score_0_100 ?? "n/a"}`);
      }
    }
  }

  return Buffer.from(await pdf.save());
}

function is_candidate_feedback_payload(payload: CandidateFeedbackData | IndividualReportData): payload is CandidateFeedbackData {
  return "feedback_indicator" in payload;
}

function assert_report_access(viewer: ReportViewer, candidate_id: string, manager_id?: string | null) {
  if (viewer.role === "SUPER_ADMIN" || viewer.role === "HR_ADMIN") {
    return;
  }

  if (viewer.role === "MANAGER" && manager_id === viewer.id) {
    return;
  }

  if (viewer.role === "CANDIDATE" && viewer.id === candidate_id) {
    return;
  }

  throw new Error("You do not have permission to view this report.");
}

function serialize_driver(entry: unknown) {
  const driver = as_record(entry) ?? {};
  return {
    gap_to_ideal: as_number(driver.gap_to_ideal) ?? null,
    label: as_string(driver.label) ?? "Unknown",
    weighted_contribution: as_number(driver.weighted_contribution) ?? null,
  };
}

function simplify_recommendation(recommendation: string | null) {
  switch (recommendation) {
    case "STRONG_FIT":
      return "Strong alignment";
    case "FIT":
      return "Good alignment";
    case "DEVELOP":
      return "Potential with focused development";
    case "POOR_FIT":
      return "Role stretch currently visible";
    default:
      return "Assessment complete";
  }
}

function to_json_input(value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function parse_hex_color(input: string) {
  const sanitized = input.replace("#", "");
  const normalized = sanitized.length === 3 ? sanitized.split("").map((value) => `${value}${value}`).join("") : sanitized.padEnd(6, "0").slice(0, 6);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  return rgb(red, green, blue);
}

function wrap_text(text: string, font: Awaited<ReturnType<typeof PdfDocument.create>> extends never ? never : { widthOfTextAtSize(text: string, size: number): number }, size: number, max_width: number) {
  const words = text.split(/\s+/).filter(Boolean);

  if (!words.length) {
    return [""];
  }

  const lines: string[] = [];
  let current_line = words[0] ?? "";

  for (const word of words.slice(1)) {
    const candidate = `${current_line} ${word}`;

    if (font.widthOfTextAtSize(candidate, size) <= max_width) {
      current_line = candidate;
    } else {
      lines.push(current_line);
      current_line = word;
    }
  }

  lines.push(current_line);
  return lines;
}
