import { AssessmentLayerCode, AssessmentVersionStatus, ItemType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type {
  AssessmentConfigSnapshot,
  AssessmentVersionDto,
  RoleFamilyAssessmentOverride,
  SectionSnapshotEditor,
} from "@/lib/assessment-configuration-types";

const layer_order: AssessmentLayerCode[] = ["COGNITIVE", "PERSONALITY", "MOTIVATORS", "EXECUTION", "LEADERSHIP", "SJT"];

const section_schema = z.object({
  break_after: z.boolean().optional(),
  enabled: z.boolean(),
  item_count: z.number().int().min(0),
  item_type_filters: z.array(z.nativeEnum(ItemType)).min(1),
  layer_code: z.string().min(1),
  order: z.number().int().positive(),
  pagination_style: z.string().optional(),
  q_sort_distribution: z.record(z.string(), z.number().int().nonnegative()).optional(),
  tag_filters: z.record(z.string(), z.string()).optional(),
  time_limit_seconds: z.number().int().positive().nullable().optional(),
});

const role_family_override_schema = z.object({
  break_point_after_layer: z.string().nullable().optional(),
  section_overrides: z.record(
    z.string(),
    z.object({
      break_after: z.boolean().optional(),
      enabled: z.boolean().optional(),
      item_count: z.number().int().min(0).optional(),
      item_type_filters: z.array(z.nativeEnum(ItemType)).optional(),
      order: z.number().int().positive().optional(),
      pagination_style: z.string().optional(),
      q_sort_distribution: z.record(z.string(), z.number().int().nonnegative()).optional(),
      tag_filters: z.record(z.string(), z.string()).optional(),
      time_limit_seconds: z.number().int().positive().nullable().optional(),
    }),
  ).optional(),
  total_battery_time_cap_seconds: z.number().int().positive().nullable().optional(),
});

const assessment_config_schema = z.object({
  anti_gaming_thresholds: z.object({
    max_flags_before_invalidation: z.number().int().positive(),
    max_straight_line_count: z.number().int().positive(),
    speed_anomaly_seconds: z.number().int().positive(),
  }),
  break_point_after_layer: z.string().nullable().optional(),
  draft_preview_enabled: z.boolean().optional(),
  dropout_threshold_pct: z.number().int().min(0).max(100),
  pause_resume_rules: z.object({
    allow_pause: z.boolean(),
    allow_resume: z.boolean(),
  }),
  per_item_timers_enabled: z.boolean(),
  personality_hiring_allowed: z.boolean(),
  proctor_mode_default: z.boolean(),
  publish_notes: z.string().optional(),
  question_randomisation: z.boolean(),
  role_family_overrides: z.record(z.string(), role_family_override_schema).optional(),
  section_randomisation: z.boolean(),
  total_battery_time_cap_seconds: z.number().int().positive(),
});

export const assessment_version_create_schema = z.object({
  source_version_id: z.string().min(1).optional(),
});

export const assessment_version_update_schema = z.object({
  scoring_config_snapshot: assessment_config_schema,
  sections_snapshot: z.array(section_schema).min(1),
  version_label: z.string().min(3).max(120),
});

export async function list_assessment_versions(org_id: string): Promise<AssessmentVersionDto[]> {
  const versions = await prisma.assessmentVersion.findMany({
    where: {
      deleted_at: null,
      org_id,
    },
    include: {
      _count: {
        select: {
          assessments: true,
          campaigns: true,
        },
      },
    },
    orderBy: [{ updated_at: "desc" }],
  });

  return versions.map(serialize_assessment_version);
}

export async function create_draft_assessment_version(input: {
  actor_id: string;
  org_id: string;
  source_version_id?: string | null;
}): Promise<AssessmentVersionDto> {
  const source_version =
    input.source_version_id
      ? await prisma.assessmentVersion.findFirst({
          where: {
            deleted_at: null,
            id: input.source_version_id,
            org_id: input.org_id,
          },
        })
      : await prisma.assessmentVersion.findFirst({
          where: {
            deleted_at: null,
            org_id: input.org_id,
          },
          orderBy: [{ updated_at: "desc" }],
        });

  const sections_snapshot =
    source_version?.sections_snapshot
      ? normalize_sections_snapshot(source_version.sections_snapshot)
      : await build_default_sections_snapshot();
  const scoring_config_snapshot = source_version?.scoring_config_snapshot
    ? normalize_assessment_config(source_version.scoring_config_snapshot)
    : default_assessment_config_snapshot();

  const created = await prisma.assessmentVersion.create({
    data: {
      org_id: input.org_id,
      scoring_config_snapshot: scoring_config_snapshot as Prisma.InputJsonValue,
      sections_snapshot: sections_snapshot as Prisma.InputJsonValue,
      status: AssessmentVersionStatus.DRAFT,
      version_label: build_draft_label(source_version?.version_label),
    },
    include: {
      _count: {
        select: {
          assessments: true,
          campaigns: true,
        },
      },
    },
  });

  return serialize_assessment_version(created);
}

export async function update_assessment_version(input: {
  data: z.infer<typeof assessment_version_update_schema>;
  org_id: string;
  version_id: string;
}): Promise<AssessmentVersionDto> {
  const version = await prisma.assessmentVersion.findFirst({
    where: {
      deleted_at: null,
      id: input.version_id,
      org_id: input.org_id,
    },
  });

  if (!version) {
    throw new Error("Assessment version not found.");
  }

  if (version.status !== AssessmentVersionStatus.DRAFT) {
    throw new Error("Only draft versions can be edited.");
  }

  const updated = await prisma.assessmentVersion.update({
    where: { id: version.id },
    data: {
      scoring_config_snapshot: input.data.scoring_config_snapshot as Prisma.InputJsonValue,
      sections_snapshot: input.data.sections_snapshot as Prisma.InputJsonValue,
      version_label: input.data.version_label,
    },
    include: {
      _count: {
        select: {
          assessments: true,
          campaigns: true,
        },
      },
    },
  });

  return serialize_assessment_version(updated);
}

export async function publish_assessment_version(input: {
  actor_id: string;
  org_id: string;
  version_id: string;
}): Promise<AssessmentVersionDto> {
  const version = await prisma.assessmentVersion.findFirst({
    where: {
      deleted_at: null,
      id: input.version_id,
      org_id: input.org_id,
    },
  });

  if (!version) {
    throw new Error("Assessment version not found.");
  }

  if (version.status === AssessmentVersionStatus.ARCHIVED) {
    throw new Error("Archived versions cannot be published.");
  }

  const [, published] = await prisma.$transaction([
    prisma.assessmentVersion.updateMany({
      where: {
        deleted_at: null,
        id: { not: version.id },
        org_id: input.org_id,
        status: AssessmentVersionStatus.PUBLISHED,
      },
      data: {
        status: AssessmentVersionStatus.ARCHIVED,
      },
    }),
    prisma.assessmentVersion.update({
      where: { id: version.id },
      data: {
        published_at: new Date(),
        published_by: input.actor_id,
        status: AssessmentVersionStatus.PUBLISHED,
      },
      include: {
        _count: {
          select: {
            assessments: true,
            campaigns: true,
          },
        },
      },
    }),
  ]);

  return serialize_assessment_version(published);
}

export async function archive_assessment_version(input: { org_id: string; version_id: string }): Promise<AssessmentVersionDto> {
  const version = await prisma.assessmentVersion.findFirst({
    where: {
      deleted_at: null,
      id: input.version_id,
      org_id: input.org_id,
    },
  });

  if (!version) {
    throw new Error("Assessment version not found.");
  }

  const archived = await prisma.assessmentVersion.update({
    where: { id: version.id },
    data: {
      status: AssessmentVersionStatus.ARCHIVED,
    },
    include: {
      _count: {
        select: {
          assessments: true,
          campaigns: true,
        },
      },
    },
  });

  return serialize_assessment_version(archived);
}

export function default_assessment_config_snapshot(): AssessmentConfigSnapshot {
  return {
    anti_gaming_thresholds: {
      max_flags_before_invalidation: 3,
      max_straight_line_count: 5,
      speed_anomaly_seconds: 3,
    },
    break_point_after_layer: "MOTIVATORS",
    draft_preview_enabled: true,
    dropout_threshold_pct: 15,
    pause_resume_rules: {
      allow_pause: true,
      allow_resume: true,
    },
    per_item_timers_enabled: true,
    personality_hiring_allowed: false,
    proctor_mode_default: false,
    question_randomisation: true,
    section_randomisation: false,
    total_battery_time_cap_seconds: 4800,
  };
}

function serialize_assessment_version(version: {
  _count: { assessments: number; campaigns: number };
  created_at: Date;
  id: string;
  published_at: Date | null;
  scoring_config_snapshot: Prisma.JsonValue;
  sections_snapshot: Prisma.JsonValue;
  status: AssessmentVersionStatus;
  updated_at: Date;
  version_label: string;
}): AssessmentVersionDto {
  const scoring_config_snapshot = normalize_assessment_config(version.scoring_config_snapshot);

  return {
    assessment_count: version._count.assessments,
    created_at: version.created_at.toISOString(),
    id: version.id,
    published_at: version.published_at?.toISOString() ?? null,
    role_family_override_count: Object.keys(scoring_config_snapshot.role_family_overrides ?? {}).length,
    scoring_config_snapshot,
    sections_snapshot: normalize_sections_snapshot(version.sections_snapshot),
    status: version.status,
    updated_at: version.updated_at.toISOString(),
    usage_campaign_count: version._count.campaigns,
    version_label: version.version_label,
  };
}

function normalize_assessment_config(value: Prisma.JsonValue): AssessmentConfigSnapshot {
  const record = as_record(value);
  const defaults = default_assessment_config_snapshot();

  return {
    anti_gaming_thresholds: {
      max_flags_before_invalidation:
        typeof as_record(record.anti_gaming_thresholds).max_flags_before_invalidation === "number"
          ? Number(as_record(record.anti_gaming_thresholds).max_flags_before_invalidation)
          : defaults.anti_gaming_thresholds.max_flags_before_invalidation,
      max_straight_line_count:
        typeof as_record(record.anti_gaming_thresholds).max_straight_line_count === "number"
          ? Number(as_record(record.anti_gaming_thresholds).max_straight_line_count)
          : defaults.anti_gaming_thresholds.max_straight_line_count,
      speed_anomaly_seconds:
        typeof as_record(record.anti_gaming_thresholds).speed_anomaly_seconds === "number"
          ? Number(as_record(record.anti_gaming_thresholds).speed_anomaly_seconds)
          : defaults.anti_gaming_thresholds.speed_anomaly_seconds,
    },
    break_point_after_layer:
      typeof record.break_point_after_layer === "string" || record.break_point_after_layer === null
        ? (record.break_point_after_layer as string | null)
        : defaults.break_point_after_layer,
    draft_preview_enabled: typeof record.draft_preview_enabled === "boolean" ? record.draft_preview_enabled : defaults.draft_preview_enabled,
    dropout_threshold_pct:
      typeof record.dropout_threshold_pct === "number" ? Number(record.dropout_threshold_pct) : defaults.dropout_threshold_pct,
    pause_resume_rules: {
      allow_pause:
        typeof as_record(record.pause_resume_rules).allow_pause === "boolean"
          ? Boolean(as_record(record.pause_resume_rules).allow_pause)
          : defaults.pause_resume_rules.allow_pause,
      allow_resume:
        typeof as_record(record.pause_resume_rules).allow_resume === "boolean"
          ? Boolean(as_record(record.pause_resume_rules).allow_resume)
          : defaults.pause_resume_rules.allow_resume,
    },
    per_item_timers_enabled:
      typeof record.per_item_timers_enabled === "boolean" ? record.per_item_timers_enabled : defaults.per_item_timers_enabled,
    personality_hiring_allowed:
      typeof record.personality_hiring_allowed === "boolean" ? record.personality_hiring_allowed : defaults.personality_hiring_allowed,
    proctor_mode_default: typeof record.proctor_mode_default === "boolean" ? record.proctor_mode_default : defaults.proctor_mode_default,
    publish_notes: typeof record.publish_notes === "string" ? record.publish_notes : undefined,
    question_randomisation:
      typeof record.question_randomisation === "boolean" ? record.question_randomisation : defaults.question_randomisation,
    role_family_overrides: normalize_role_family_overrides(record.role_family_overrides),
    section_randomisation:
      typeof record.section_randomisation === "boolean" ? record.section_randomisation : defaults.section_randomisation,
    total_battery_time_cap_seconds:
      typeof record.total_battery_time_cap_seconds === "number"
        ? Number(record.total_battery_time_cap_seconds)
        : defaults.total_battery_time_cap_seconds,
  };
}

function normalize_role_family_overrides(value: unknown): Record<string, RoleFamilyAssessmentOverride> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([role_family_id, override]) => {
      const record = as_record(override);
      const section_overrides = as_record(record.section_overrides);

      return [
        role_family_id,
        {
          break_point_after_layer:
            typeof record.break_point_after_layer === "string" || record.break_point_after_layer === null
              ? (record.break_point_after_layer as string | null)
              : undefined,
          section_overrides: Object.fromEntries(
            Object.entries(section_overrides).map(([layer_code, section_value]) => {
              const section = as_record(section_value);
              return [
                layer_code,
                {
                  break_after: typeof section.break_after === "boolean" ? section.break_after : undefined,
                  enabled: typeof section.enabled === "boolean" ? section.enabled : undefined,
                  item_count: typeof section.item_count === "number" ? Number(section.item_count) : undefined,
                  item_type_filters: Array.isArray(section.item_type_filters)
                    ? section.item_type_filters.filter((entry): entry is ItemType => typeof entry === "string") as ItemType[]
                    : undefined,
                  order: typeof section.order === "number" ? Number(section.order) : undefined,
                  pagination_style: typeof section.pagination_style === "string" ? section.pagination_style : undefined,
                  q_sort_distribution: normalize_string_number_record(section.q_sort_distribution),
                  tag_filters: normalize_string_string_record(section.tag_filters),
                  time_limit_seconds:
                    typeof section.time_limit_seconds === "number" || section.time_limit_seconds === null
                      ? (section.time_limit_seconds as number | null)
                      : undefined,
                },
              ];
            }),
          ),
          total_battery_time_cap_seconds:
            typeof record.total_battery_time_cap_seconds === "number" || record.total_battery_time_cap_seconds === null
              ? (record.total_battery_time_cap_seconds as number | null)
              : undefined,
        } satisfies RoleFamilyAssessmentOverride,
      ];
    }),
  );
}

function normalize_sections_snapshot(value: Prisma.JsonValue): SectionSnapshotEditor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...value]
    .map((entry) => {
      const section = as_record(entry);
      return {
        break_after: typeof section.break_after === "boolean" ? section.break_after : undefined,
        enabled: typeof section.enabled === "boolean" ? section.enabled : true,
        item_count: typeof section.item_count === "number" ? Number(section.item_count) : 0,
        item_type_filters: Array.isArray(section.item_type_filters)
          ? (section.item_type_filters.filter((item_type): item_type is ItemType => typeof item_type === "string") as ItemType[])
          : ["MCQ"],
        layer_code: typeof section.layer_code === "string" ? section.layer_code : "",
        order: typeof section.order === "number" ? Number(section.order) : 1,
        pagination_style: typeof section.pagination_style === "string" ? section.pagination_style : "single",
        q_sort_distribution: normalize_string_number_record(section.q_sort_distribution),
        tag_filters: normalize_string_string_record(section.tag_filters),
        time_limit_seconds:
          typeof section.time_limit_seconds === "number" || section.time_limit_seconds === null
            ? (section.time_limit_seconds as number | null)
            : null,
      } satisfies SectionSnapshotEditor;
    })
    .sort((left, right) => left.order - right.order);
}

async function build_default_sections_snapshot(): Promise<SectionSnapshotEditor[]> {
  const layers = await prisma.assessmentLayer.findMany({
    where: {
      deleted_at: null,
      is_active: true,
    },
  });
  const layer_codes = new Set(layers.map((layer) => layer.code));

  return layer_order
    .filter((layer_code) => layer_codes.has(layer_code))
    .map((layer_code, index) => ({
      break_after: layer_code === "MOTIVATORS",
      enabled: true,
      item_count: layer_code === "MOTIVATORS" ? 20 : 10,
      item_type_filters: default_item_type_filters(layer_code),
      layer_code,
      order: index + 1,
      pagination_style: layer_code === "MOTIVATORS" ? "section" : "single",
      q_sort_distribution:
        layer_code === "MOTIVATORS"
          ? {
              Important: 6,
              "Least Important": 4,
              "Most Important": 4,
              "Somewhat Important": 6,
            }
          : undefined,
      tag_filters: layer_code === "LEADERSHIP" ? { audience: "SELF" } : undefined,
      time_limit_seconds: layer_code === "SJT" ? 660 : layer_code === "MOTIVATORS" ? 720 : 900,
    }));
}

function build_draft_label(source_label?: string | null) {
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "-").slice(0, 15);
  const base = source_label ? source_label.replace(/-(draft|published|archived).*$/i, "") : "assessment-version";
  return `${base}-draft-${stamp}`;
}

function default_item_type_filters(layer_code: AssessmentLayerCode): ItemType[] {
  switch (layer_code) {
    case "COGNITIVE":
      return ["MCQ"];
    case "PERSONALITY":
      return ["FORCED_CHOICE_TRIAD"];
    case "MOTIVATORS":
      return ["Q_SORT"];
    case "EXECUTION":
      return ["LIKERT", "SCENARIO"];
    case "LEADERSHIP":
      return ["SCENARIO"];
    case "SJT":
      return ["SCENARIO"];
    default:
      return ["MCQ"];
  }
}

function normalize_string_string_record(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(([, entry]) => typeof entry === "string");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalize_string_number_record(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(([, entry]) => typeof entry === "number");
  return entries.length ? Object.fromEntries(entries.map(([key, entry]) => [key, Number(entry)])) : undefined;
}

function as_record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
