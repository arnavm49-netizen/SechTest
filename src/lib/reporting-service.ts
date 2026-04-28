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
      nine_box: latest_fit?.nine_box ?? null,
      performance_pct: latest_fit?.performance_pct ?? null,
      potential_pct: latest_fit?.potential_pct ?? null,
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
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const accent = parse_hex_color(as_string(branding.accent_color) ?? "#d4232a");
  const dark = parse_hex_color(as_string(branding.primary_text) ?? "#0a0a0a");
  const muted = rgb(0.45, 0.45, 0.45);
  const light_grey = rgb(0.96, 0.96, 0.95);
  const bar_bg = rgb(0.92, 0.92, 0.91);
  const bar_green = rgb(0.16, 0.65, 0.38);
  const bar_amber = rgb(0.8, 0.55, 0.1);
  const bar_red = rgb(0.78, 0.15, 0.15);
  const white = rgb(1, 1, 1);
  const W = 612;
  const H = 792;
  const ML = 48;
  const MR = 48;
  const MT = 48;
  const MB = 60;
  const CW = W - ML - MR;

  let page = pdf.addPage([W, H]);
  let y = H - MT;

  function new_page() { page = pdf.addPage([W, H]); y = H - MT; }
  function need(h: number) { if (y - h < MB) new_page(); }

  function text(t: string, opts?: { x?: number; size?: number; font?: typeof regular; color?: ReturnType<typeof rgb>; maxW?: number }) {
    const s = opts?.size ?? 9;
    const f = opts?.font ?? regular;
    const c = opts?.color ?? dark;
    const x = opts?.x ?? ML;
    const mw = opts?.maxW ?? CW;
    const lines = wrap_text(t, f, s, mw);
    need(lines.length * (s + 3) + 4);
    for (const ln of lines) { page.drawText(ln, { x, y, size: s, font: f, color: c }); y -= s + 3; }
    y -= 2;
  }

  function gap(h = 10) { y -= h; }

  function heading(t: string, s = 14) {
    need(s + 20);
    gap(6);
    page.drawRectangle({ x: ML, y: y - 2, width: CW, height: 1, color: bar_bg });
    y -= 8;
    text(t, { size: s, font: bold });
    gap(4);
  }

  function subheading(t: string) {
    need(24);
    text(t, { size: 10, font: bold, color: accent });
    gap(2);
  }

  function draw_bar(label: string, value: number | null, max = 100, x_start = ML, bar_width = CW) {
    const v = value ?? 0;
    const bar_h = 14;
    const label_w = 160;
    const actual_bar_w = bar_width - label_w - 40;
    need(bar_h + 8);

    // Label
    page.drawText(label, { x: x_start, y: y - 2, size: 8, font: regular, color: dark });

    // Background bar
    const bx = x_start + label_w;
    page.drawRectangle({ x: bx, y: y - 4, width: actual_bar_w, height: bar_h, color: bar_bg, borderWidth: 0 });

    // Filled bar
    const fill_w = Math.max(2, (v / max) * actual_bar_w);
    const fill_color = v >= 67 ? bar_green : v >= 33 ? bar_amber : bar_red;
    page.drawRectangle({ x: bx, y: y - 4, width: fill_w, height: bar_h, color: fill_color, borderWidth: 0 });

    // Value text
    const val_text = value !== null ? `${Math.round(v)}` : "n/a";
    page.drawText(val_text, { x: bx + actual_bar_w + 6, y: y - 1, size: 8, font: bold, color: dark });

    y -= bar_h + 8;
  }

  function draw_kv(label: string, value: string, x_start = ML) {
    need(16);
    page.drawText(label, { x: x_start, y, size: 8, font: regular, color: muted });
    page.drawText(value, { x: x_start + 140, y, size: 8, font: bold, color: dark });
    y -= 14;
  }

  // ══════════════════════════════════════════════════════════════
  // COVER / HEADER
  // ══════════════════════════════════════════════════════════════
  page.drawRectangle({ x: 0, y: H - 100, width: W, height: 100, color: accent });
  page.drawText("D&H SECHERON", { x: ML, y: H - 40, size: 10, font: bold, color: white });
  page.drawText(title, { x: ML, y: H - 62, size: 20, font: bold, color: white });
  page.drawText(`Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, {
    x: ML, y: H - 82, size: 8, font: regular, color: rgb(1, 1, 1),
  });
  y = H - 120;

  // ══════════════════════════════════════════════════════════════
  // CANDIDATE INFO
  // ══════════════════════════════════════════════════════════════
  heading("Candidate Information", 12);
  draw_kv("Name", payload.assessment.candidate_name);
  draw_kv("Role family", payload.assessment.role_family_name);

  if (is_candidate_feedback_payload(payload)) {
    // ── CANDIDATE FEEDBACK REPORT ──
    draw_kv("Fit indicator", payload.feedback_indicator);
    gap(6);

    heading("Your Strengths");
    if (payload.strengths.length) {
      for (const s of payload.strengths) {
        text(`   ${s.label}`, { size: 9 });
      }
    } else {
      text("   No strength data available yet.", { color: muted });
    }

    heading("Areas for Growth");
    if (payload.development_areas.length) {
      for (const d of payload.development_areas) {
        const score_text = d.score_0_100 !== null ? ` (score: ${Math.round(d.score_0_100)}/100)` : "";
        text(`   ${d.sub_dimension_name}${score_text}`, { size: 9 });
        if (d.recommendation_texts?.length) {
          for (const rec of d.recommendation_texts.slice(0, 2)) {
            text(`      ${rec}`, { size: 8, color: muted });
          }
        }
        gap(4);
      }
    } else {
      text("   No development areas identified.", { color: muted });
    }

    heading("What This Means");
    text("This report provides a high-level summary of your assessment results. Your strengths indicate areas where your profile aligns well with role expectations. Growth areas are not weaknesses — they are opportunities for focused development.");
    gap(4);
    text("Your HR administrator has access to a more detailed report. If you have questions about your results or want to discuss a development plan, please speak with your manager or HR contact.");

  } else {
    // ── FULL INDIVIDUAL REPORT ──
    draw_kv("Fit score", `${Math.round(payload.fit.fit_score_pct ?? 0)}%`);
    draw_kv("Recommendation", payload.fit.recommendation ?? "Pending");
    if (payload.fit.nine_box) {
      draw_kv("9-Box placement", payload.fit.nine_box.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()));
    }
    if (payload.fit.performance_pct != null) {
      draw_kv("Performance score", `${Math.round(payload.fit.performance_pct)}%`);
    }
    if (payload.fit.potential_pct != null) {
      draw_kv("Potential score", `${Math.round(payload.fit.potential_pct)}%`);
    }
    gap(6);

    // ── LAYER SCORES ──
    heading("Assessment Layer Scores");
    text("Scores are normalised to 0–100. Green (67+) = strong, amber (33–66) = moderate, red (<33) = development area.", { size: 8, color: muted });
    gap(6);
    if (payload.layer_scores.length) {
      for (const score of payload.layer_scores) {
        draw_bar(score.label, score.score_0_100);
      }
    } else {
      text("   No layer scores available.", { color: muted });
    }

    // ── TOP STRENGTHS ──
    heading("Key Strengths (Top Drivers)");
    if (payload.fit.top_drivers.length) {
      for (const driver of payload.fit.top_drivers) {
        const contrib = driver.weighted_contribution != null ? ` — weighted contribution: ${driver.weighted_contribution}` : "";
        text(`   ${driver.label}${contrib}`, { size: 9 });
      }
    } else {
      text("   No top drivers identified.", { color: muted });
    }

    // ── DEVELOPMENT AREAS ──
    heading("Development Priorities");
    if (payload.fit.top_constraints.length) {
      for (const gap_item of payload.fit.top_constraints) {
        const gap_val = gap_item.gap_to_ideal != null ? ` — gap to ideal: ${Math.round(gap_item.gap_to_ideal)}` : "";
        text(`   ${gap_item.label}${gap_val}`, { size: 9 });
      }
    } else {
      text("   No constraints identified.", { color: muted });
    }

    if (payload.development_plan.length) {
      gap(4);
      subheading("Detailed Development Areas");
      for (const dim of payload.development_plan.slice(0, 8)) {
        draw_bar(dim.sub_dimension_name, dim.score_0_100);
        if (dim.recommendation_texts?.length) {
          for (const rec of dim.recommendation_texts.slice(0, 1)) {
            text(`      Recommendation: ${rec}`, { size: 7.5, color: muted });
          }
          gap(2);
        }
      }
    }

    // ── PERSONALITY VECTOR ──
    if (payload.personality_vector?.length) {
      heading("Personality Profile");
      for (const trait of payload.personality_vector) {
        draw_bar(trait.sub_dimension_name, (trait.score_0_10 / 10) * 100);
      }
    }

    // ── MOTIVATION ──
    if (payload.motivation_archetype?.length) {
      heading("Motivational Profile");
      for (const motive of payload.motivation_archetype) {
        draw_bar(motive.archetype, motive.score_0_100);
      }
    }

    // ── BLIND SPOTS ──
    if (payload.blind_spot_gaps?.length) {
      const flagged = payload.blind_spot_gaps.filter((g) => g.blind_spot_flag);
      if (flagged.length) {
        heading("360 Blind Spot Analysis");
        text("Dimensions where self-assessment diverges significantly from peer/manager ratings.", { size: 8, color: muted });
        gap(4);
        for (const bs of flagged) {
          text(`   ${bs.sub_dimension_name}: Self ${Math.round(bs.self_score_100)} vs Peers ${Math.round(bs.peer_average_100 ?? 0)}`, { size: 9 });
        }
      }
    }

    // ── BEHAVIOUR MAPS ──
    if (payload.behaviour_maps?.length) {
      heading("Behaviour-Outcome Links");
      for (const bm of payload.behaviour_maps.slice(0, 6)) {
        text(`   ${bm.sub_dimension_name}`, { size: 9, font: bold });
        text(`      Behaviour: ${bm.behaviour_description}`, { size: 8, color: muted });
        text(`      Outcome: ${bm.outcome_description}`, { size: 8, color: muted });
        gap(4);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // FOOTER ON EVERY PAGE
  // ══════════════════════════════════════════════════════════════
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!;
    p.drawText(`D&H Secheron — Confidential`, { x: ML, y: 24, size: 7, font: regular, color: muted });
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: W - MR - 60, y: 24, size: 7, font: regular, color: muted });
    p.drawRectangle({ x: ML, y: 38, width: CW, height: 0.5, color: bar_bg });
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
