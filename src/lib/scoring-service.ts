import { ScoringModelStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type {
  AssessmentScoringSummary,
  NormGroupDto,
  ReliabilitySnapshotDto,
  ScoringAdminSnapshot,
  ScoringModelDto,
  ScoringRunDto,
} from "@/lib/scoring-admin-types";
import { default_scoring_model_config, normalize_scoring_model_config, scoring_model_config_schema } from "@/lib/scoring/config";
import { build_reliability_snapshot, execute_scoring_pipeline, recompute_norm_group_statistics } from "@/lib/scoring-pipeline";
import type { ScoringEngineMode } from "@/lib/scoring/types";

const scoring_engine_mode_schema = z.enum(["PHASE_A_CLASSICAL", "PHASE_B_HYBRID_IRT"]);

export const scoring_model_create_schema = z.object({
  engine_mode: scoring_engine_mode_schema.default("PHASE_A_CLASSICAL"),
  source_model_id: z.string().min(1).optional(),
});

export const scoring_model_update_schema = z.object({
  config: scoring_model_config_schema,
  engine_mode: scoring_engine_mode_schema,
  name: z.string().min(3).max(120),
  notes: z.string().max(4000).nullable().optional(),
  version_label: z.string().min(3).max(120),
});

export const scoring_model_publish_schema = z.object({
  target_status: z.enum(["CHALLENGER", "LIVE"]),
});

export const scoring_run_schema = z.object({
  assessment_id: z.string().min(1),
  model_id: z.string().min(1).optional(),
});

export const norm_group_create_schema = z.object({
  description: z.string().min(10).max(500),
  name: z.string().min(3).max(120),
});

export const norm_group_assignment_schema = z.object({
  assessment_ids: z.array(z.string().min(1)).min(1),
});

export const norm_group_recompute_schema = z.object({
  model_id: z.string().min(1).optional(),
});

export async function get_scoring_admin_snapshot(org_id: string): Promise<ScoringAdminSnapshot> {
  const [models, norm_groups, assessments, recent_runs] = await Promise.all([
    prisma.scoringModel.findMany({
      where: {
        deleted_at: null,
        org_id,
      },
      include: {
        _count: {
          select: {
            scoring_runs: {
              where: {
                deleted_at: null,
              },
            },
          },
        },
      },
      orderBy: [{ updated_at: "desc" }],
    }),
    prisma.normGroup.findMany({
      where: {
        deleted_at: null,
        org_id,
      },
      include: {
        _count: {
          select: {
            members: {
              where: {
                deleted_at: null,
              },
            },
            norm_statistics: true,
          },
        },
        norm_statistics: {
          orderBy: { computed_at: "desc" },
          take: 1,
        },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.assessment.findMany({
      where: {
        deleted_at: null,
        org_id,
      },
      include: {
        assessment_version: true,
        candidate: true,
        role_family: true,
        role_fit_results: {
          where: {
            deleted_at: null,
          },
          orderBy: { created_at: "desc" },
          take: 1,
        },
        scoring_runs: {
          where: {
            deleted_at: null,
          },
          include: {
            scoring_model: true,
          },
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
      orderBy: [{ updated_at: "desc" }],
      take: 30,
    }),
    prisma.scoringRun.findMany({
      where: {
        deleted_at: null,
        assessment: {
          org_id,
        },
      },
      include: {
        assessment: {
          include: {
            candidate: true,
            role_family: true,
          },
        },
        scoring_model: true,
      },
      orderBy: [{ created_at: "desc" }],
      take: 20,
    }),
  ]);

  const preferred_model = models.find((model) => model.status === "LIVE") ?? models.find((model) => model.status === "CHALLENGER") ?? models[0];
  const reliability = await build_reliability_snapshot({
    model_version: preferred_model?.version_label ?? null,
    org_id,
  });

  return {
    assessments: assessments.map(serialize_assessment_summary),
    models: models.map(serialize_scoring_model),
    norm_groups: norm_groups.map(serialize_norm_group),
    recent_runs: recent_runs.map(serialize_scoring_run),
    reliability: reliability.map(serialize_reliability_snapshot),
  };
}

export async function create_draft_scoring_model(input: {
  actor_id: string;
  data: z.infer<typeof scoring_model_create_schema>;
  org_id: string;
}): Promise<ScoringModelDto> {
  const source_model =
    input.data.source_model_id
      ? await prisma.scoringModel.findFirst({
          where: {
            deleted_at: null,
            id: input.data.source_model_id,
            org_id: input.org_id,
          },
        })
      : await prisma.scoringModel.findFirst({
          where: {
            deleted_at: null,
            org_id: input.org_id,
          },
          orderBy: [{ updated_at: "desc" }],
        });
  const engine_mode = (source_model?.engine_mode as ScoringEngineMode | undefined) ?? input.data.engine_mode;
  const created = await prisma.scoringModel.create({
    data: {
      config: source_model ? normalize_scoring_model_config(source_model.config, engine_mode) : default_scoring_model_config(engine_mode),
      created_by: input.actor_id,
      engine_mode,
      name: source_model ? `${source_model.name} Draft` : engine_mode === "PHASE_B_HYBRID_IRT" ? "Hybrid IRT Engine" : "Classical Engine",
      notes: source_model?.notes ?? `Draft copied for ${engine_mode}.`,
      org_id: input.org_id,
      status: ScoringModelStatus.DRAFT,
      version_label: build_draft_version_label(source_model?.version_label),
    },
    include: {
      _count: {
        select: {
          scoring_runs: {
            where: { deleted_at: null },
          },
        },
      },
    },
  });

  return serialize_scoring_model(created);
}

export async function update_scoring_model(input: {
  data: z.infer<typeof scoring_model_update_schema>;
  model_id: string;
  org_id: string;
}): Promise<ScoringModelDto> {
  const existing = await prisma.scoringModel.findFirst({
    where: {
      deleted_at: null,
      id: input.model_id,
      org_id: input.org_id,
    },
    include: {
      _count: {
        select: {
          scoring_runs: {
            where: { deleted_at: null },
          },
        },
      },
    },
  });

  if (!existing) {
    throw new Error("Scoring model not found.");
  }

  if (existing.status === ScoringModelStatus.ARCHIVED) {
    throw new Error("Archived scoring models cannot be edited.");
  }

  const updated = await prisma.scoringModel.update({
    where: { id: existing.id },
    data: {
      config: input.data.config,
      engine_mode: input.data.engine_mode,
      name: input.data.name,
      notes: input.data.notes ?? null,
      version_label: input.data.version_label,
    },
    include: {
      _count: {
        select: {
          scoring_runs: {
            where: { deleted_at: null },
          },
        },
      },
    },
  });

  return serialize_scoring_model(updated);
}

export async function publish_scoring_model(input: {
  actor_id: string;
  model_id: string;
  org_id: string;
  target_status: "CHALLENGER" | "LIVE";
}): Promise<ScoringModelDto> {
  const existing = await prisma.scoringModel.findFirst({
    where: {
      deleted_at: null,
      id: input.model_id,
      org_id: input.org_id,
    },
    include: {
      _count: {
        select: {
          scoring_runs: {
            where: { deleted_at: null },
          },
        },
      },
    },
  });

  if (!existing) {
    throw new Error("Scoring model not found.");
  }

  const [, published] = await prisma.$transaction([
    prisma.scoringModel.updateMany({
      where: {
        deleted_at: null,
        id: { not: existing.id },
        org_id: input.org_id,
        status: input.target_status,
      },
      data: {
        status: ScoringModelStatus.ARCHIVED,
      },
    }),
    prisma.scoringModel.update({
      where: { id: existing.id },
      data: {
        published_at: new Date(),
        published_by: input.actor_id,
        status: input.target_status,
      },
      include: {
        _count: {
          select: {
            scoring_runs: {
              where: { deleted_at: null },
            },
          },
        },
      },
    }),
  ]);

  return serialize_scoring_model(published);
}

export async function archive_scoring_model(input: {
  model_id: string;
  org_id: string;
}): Promise<ScoringModelDto> {
  const existing = await prisma.scoringModel.findFirst({
    where: {
      deleted_at: null,
      id: input.model_id,
      org_id: input.org_id,
    },
    include: {
      _count: {
        select: {
          scoring_runs: {
            where: { deleted_at: null },
          },
        },
      },
    },
  });

  if (!existing) {
    throw new Error("Scoring model not found.");
  }

  const archived = await prisma.scoringModel.update({
    where: { id: existing.id },
    data: {
      status: ScoringModelStatus.ARCHIVED,
    },
    include: {
      _count: {
        select: {
          scoring_runs: {
            where: { deleted_at: null },
          },
        },
      },
    },
  });

  return serialize_scoring_model(archived);
}

export async function run_scoring_for_assessment(input: {
  assessment_id: string;
  model_id?: string | null;
  org_id: string;
}): Promise<ScoringRunDto> {
  const assessment = await prisma.assessment.findFirst({
    where: {
      deleted_at: null,
      id: input.assessment_id,
      org_id: input.org_id,
    },
  });

  if (!assessment) {
    throw new Error("Assessment not found.");
  }

  const model =
    input.model_id
      ? await prisma.scoringModel.findFirst({
          where: {
            deleted_at: null,
            id: input.model_id,
            org_id: input.org_id,
          },
        })
      : await prisma.scoringModel.findFirst({
          where: {
            deleted_at: null,
            org_id: input.org_id,
            status: ScoringModelStatus.LIVE,
          },
          orderBy: [{ updated_at: "desc" }],
        });

  if (!model) {
    throw new Error("No scoring model is available for this organisation.");
  }

  const run = await execute_scoring_pipeline({
    assessment_id: assessment.id,
    scoring_model_id: model.id,
  });
  const stored = await prisma.scoringRun.findFirst({
    where: {
      deleted_at: null,
      id: run.run_id,
    },
    include: {
      assessment: {
        include: {
          candidate: true,
          role_family: true,
        },
      },
      scoring_model: true,
    },
  });

  if (!stored) {
    throw new Error("Unable to load the completed scoring run.");
  }

  return serialize_scoring_run(stored);
}

export async function create_norm_group(input: {
  data: z.infer<typeof norm_group_create_schema>;
  org_id: string;
}): Promise<NormGroupDto> {
  const created = await prisma.normGroup.create({
    data: {
      description: input.data.description,
      name: input.data.name,
      org_id: input.org_id,
    },
    include: {
      _count: {
        select: {
          members: {
            where: { deleted_at: null },
          },
          norm_statistics: true,
        },
      },
      norm_statistics: {
        orderBy: { computed_at: "desc" },
        take: 1,
      },
    },
  });

  return serialize_norm_group(created);
}

export async function assign_assessments_to_norm_group(input: {
  assessment_ids: string[];
  norm_group_id: string;
  org_id: string;
}) {
  const [group, assessments] = await Promise.all([
    prisma.normGroup.findFirst({
      where: {
        deleted_at: null,
        id: input.norm_group_id,
        org_id: input.org_id,
      },
    }),
    prisma.assessment.findMany({
      where: {
        deleted_at: null,
        id: {
          in: input.assessment_ids,
        },
        org_id: input.org_id,
      },
      select: {
        candidate_id: true,
        id: true,
      },
    }),
  ]);

  if (!group) {
    throw new Error("Norm group not found.");
  }

  for (const assessment of assessments) {
    await prisma.normGroupMember.upsert({
      where: {
        norm_group_id_assessment_id: {
          assessment_id: assessment.id,
          norm_group_id: group.id,
        },
      },
      create: {
        assessment_id: assessment.id,
        norm_group_id: group.id,
        user_id: assessment.candidate_id,
      },
      update: {
        deleted_at: null,
        user_id: assessment.candidate_id,
      },
    });
  }

  const member_count = await prisma.normGroupMember.count({
    where: {
      deleted_at: null,
      norm_group_id: group.id,
    },
  });

  await prisma.normGroup.update({
    where: { id: group.id },
    data: {
      member_count,
    },
  });
}

export async function recompute_norm_group(input: {
  model_id?: string | null;
  norm_group_id: string;
  org_id: string;
}) {
  const [group, model] = await Promise.all([
    prisma.normGroup.findFirst({
      where: {
        deleted_at: null,
        id: input.norm_group_id,
        org_id: input.org_id,
      },
    }),
    input.model_id
      ? prisma.scoringModel.findFirst({
          where: {
            deleted_at: null,
            id: input.model_id,
            org_id: input.org_id,
          },
        })
      : prisma.scoringModel.findFirst({
          where: {
            deleted_at: null,
            org_id: input.org_id,
            status: ScoringModelStatus.LIVE,
          },
          orderBy: [{ updated_at: "desc" }],
        }),
  ]);

  if (!group) {
    throw new Error("Norm group not found.");
  }

  if (!model) {
    throw new Error("Scoring model not found.");
  }

  await recompute_norm_group_statistics({
    norm_group_id: group.id,
    scoring_model_version: model.version_label,
  });
}

function build_draft_version_label(source_version_label?: string | null) {
  const base = source_version_label?.replace(/-draft.*$/i, "") ?? "score-engine";
  return `${base}-draft-${Date.now().toString().slice(-6)}`;
}

function serialize_scoring_model(model: {
  _count: { scoring_runs: number };
  config: unknown;
  created_at: Date;
  engine_mode: string;
  id: string;
  name: string;
  notes: string | null;
  published_at: Date | null;
  status: ScoringModelStatus;
  updated_at: Date;
  version_label: string;
}): ScoringModelDto {
  const engine_mode = model.engine_mode as ScoringEngineMode;

  return {
    config: normalize_scoring_model_config(model.config, engine_mode),
    created_at: model.created_at.toISOString(),
    engine_mode,
    id: model.id,
    name: model.name,
    notes: model.notes,
    published_at: model.published_at?.toISOString() ?? null,
    run_count: model._count.scoring_runs,
    status: model.status,
    updated_at: model.updated_at.toISOString(),
    version_label: model.version_label,
  };
}

function serialize_norm_group(group: {
  _count: { members: number; norm_statistics: number };
  description: string;
  id: string;
  member_count: number;
  name: string;
  norm_statistics: Array<{ computed_at: Date }>;
}): NormGroupDto {
  return {
    description: group.description,
    id: group.id,
    latest_computed_at: group.norm_statistics[0]?.computed_at.toISOString() ?? null,
    member_count: Math.max(group.member_count, group._count.members),
    name: group.name,
    statistic_count: group._count.norm_statistics,
  };
}

function serialize_assessment_summary(assessment: {
  assessment_version: { version_label: string };
  candidate: { email: string; name: string };
  completed_at: Date | null;
  id: string;
  quality_flags: unknown;
  role_family: { name: string };
  role_fit_results: Array<{ fit_score_pct: number; recommendation: AssessmentScoringSummary["latest_recommendation"] }>;
  scoring_runs: Array<{
    id: string;
    scoring_model: { version_label: string };
    status: AssessmentScoringSummary["latest_run_status"];
  }>;
  status: AssessmentScoringSummary["status"];
}): AssessmentScoringSummary {
  const latest_run = assessment.scoring_runs[0] ?? null;
  const latest_role_fit = assessment.role_fit_results[0] ?? null;

  return {
    assessment_id: assessment.id,
    assessment_version_label: assessment.assessment_version.version_label,
    candidate_email: assessment.candidate.email,
    candidate_name: assessment.candidate.name,
    completed_at: assessment.completed_at?.toISOString() ?? null,
    latest_fit_score_pct: latest_role_fit?.fit_score_pct ?? null,
    latest_recommendation: latest_role_fit?.recommendation ?? null,
    latest_run_id: latest_run?.id ?? null,
    latest_run_model_label: latest_run?.scoring_model.version_label ?? null,
    latest_run_status: latest_run?.status ?? null,
    quality_flag_count: Array.isArray(assessment.quality_flags) ? assessment.quality_flags.length : 0,
    role_family_name: assessment.role_family.name,
    status: assessment.status,
  };
}

function serialize_scoring_run(run: {
  assessment: {
    candidate: { name: string };
    id: string;
    role_family: { name: string };
  };
  completed_at: Date | null;
  id: string;
  invalid_reason: string | null;
  quality_gate_passed: boolean;
  scoring_model: { version_label: string };
  started_at: Date;
  status: ScoringRunDto["status"];
  step_outputs: unknown;
}): ScoringRunDto {
  const outputs = run.step_outputs && typeof run.step_outputs === "object" ? (run.step_outputs as Record<string, unknown>) : null;
  const role_fit = outputs?.role_fit && typeof outputs.role_fit === "object" ? (outputs.role_fit as Record<string, unknown>) : null;

  return {
    assessment_id: run.assessment.id,
    candidate_name: run.assessment.candidate.name,
    completed_at: run.completed_at?.toISOString() ?? null,
    fit_score_pct: typeof role_fit?.fit_score_pct === "number" ? role_fit.fit_score_pct : null,
    id: run.id,
    invalid_reason: run.invalid_reason,
    model_label: run.scoring_model.version_label,
    quality_gate_passed: run.quality_gate_passed,
    recommendation: typeof role_fit?.recommendation === "string" ? (role_fit.recommendation as ScoringRunDto["recommendation"]) : null,
    role_family_name: run.assessment.role_family.name,
    started_at: run.started_at.toISOString(),
    status: run.status,
    step_outputs: outputs,
  };
}

function serialize_reliability_snapshot(snapshot: ReliabilitySnapshotDto): ReliabilitySnapshotDto {
  return snapshot;
}
