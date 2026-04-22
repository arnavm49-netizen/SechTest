import { AssessmentStatus, CampaignInviteStatus, ItemType, Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { AssessmentPublicItem, AssessmentSession, AssessmentSessionSection, AssessmentStage, SectionSnapshot } from "@/lib/assessment-session";
import { normalize_item_options } from "@/lib/question-bank";

export async function hydrate_assessment_session(invite_token: string): Promise<AssessmentSession> {
  const invite = await prisma.campaignInvite.findUnique({
    where: { invite_token },
    include: {
      assessment: {
        include: {
          assessment_version: true,
          candidate: true,
          sections: {
            orderBy: { section_order: "asc" },
            include: {
              assessment_layer: true,
              responses: {
                orderBy: { sequence_number: "asc" },
              },
            },
          },
        },
      },
      campaign: {
        include: {
          assessment_version: true,
          organization: true,
          role_family: true,
        },
      },
      candidate: true,
    },
  });

  if (!invite || invite.deleted_at) {
    throw new Error("Invite not found.");
  }

  if (invite.expires_at && invite.expires_at < new Date()) {
    await prisma.campaignInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("Invite has expired.");
  }

  const assessment = invite.assessment;
  const serialized_sections: AssessmentSessionSection[] =
    assessment?.sections.length
      ? await Promise.all(
          assessment.sections.map(async (section) => {
            const item_ids = as_string_array(section.item_ids_snapshot);
            const items = await prisma.item.findMany({
              where: {
                id: { in: item_ids },
              },
              include: {
                item_options: {
                  where: { deleted_at: null },
                  orderBy: { display_order: "asc" },
                },
              },
            });

            const ordered_items = item_ids
              .map((item_id) => items.find((item) => item.id === item_id))
              .filter(Boolean)
              .map((item) => serialize_public_item(item!));

            return {
              id: section.id,
              item_ids_snapshot: item_ids,
              items: ordered_items,
              items_answered: section.items_answered,
              items_presented: section.items_presented,
              layer_code: section.assessment_layer.code,
              layer_name: section.assessment_layer.name,
              response_count: section.responses.length,
              responses: section.responses.map((response) => ({
                id: response.id,
                is_flagged: response.is_flagged,
                item_id: response.item_id,
                response_time_seconds: response.response_time_seconds,
                response_value: response.response_value,
                sequence_number: response.sequence_number,
              })),
              runtime_config_snapshot: as_record_or_null(section.runtime_config_snapshot),
              section_order: section.section_order,
              started_at: section.started_at?.toISOString() ?? null,
              status: section.status,
              time_limit_seconds: section.time_limit_seconds,
            };
          }),
        )
      : [];

  const stage: AssessmentStage =
    !assessment
      ? "landing"
      : assessment.status === "COMPLETED" || assessment.status === "INVALIDATED"
        ? "complete"
        : !assessment.consent_given_at
          ? "consent"
          : "assessment";

  return {
    assessment: assessment
      ? {
          completed_at: assessment.completed_at?.toISOString() ?? null,
          consent_given_at: assessment.consent_given_at?.toISOString() ?? null,
          created_at: assessment.created_at.toISOString(),
          id: assessment.id,
          quality_flags: as_record_array(assessment.quality_flags),
          runtime_metadata: as_record(assessment.runtime_metadata),
          sections: serialized_sections,
          started_at: assessment.started_at?.toISOString() ?? null,
          status: assessment.status,
          total_time_seconds: assessment.total_time_seconds,
        }
      : null,
    campaign: {
      deadline: invite.campaign.deadline?.toISOString() ?? null,
      id: invite.campaign.id,
      invite_template: invite.campaign.invite_template,
      name: invite.campaign.name,
      role_family: invite.campaign.role_family.name,
      version_label: invite.campaign.assessment_version.version_label,
    },
    candidate: invite.candidate
      ? {
          email: invite.candidate.email,
          id: invite.candidate.id,
          name: invite.candidate.name,
        }
      : {
          email: invite.email,
          id: null,
          name: invite.email,
        },
    invite: {
      email: invite.email,
      expires_at: invite.expires_at?.toISOString() ?? null,
      id: invite.id,
      reminder_count: invite.reminder_count,
      status: invite.status,
      token: invite.invite_token,
    },
    organization: {
      consent_text: invite.campaign.organization.dpdp_consent_template,
      logo_url: invite.campaign.organization.logo_url,
      name: invite.campaign.organization.name,
      settings: as_record(invite.campaign.organization.settings),
    },
    stage,
  };
}

export async function start_assessment_from_invite(input: {
  invite_token: string;
  runtime_metadata?: Record<string, unknown>;
}) {
  const invite = await prisma.campaignInvite.findUnique({
    where: { invite_token: input.invite_token },
    include: {
      campaign: {
        include: {
          assessment_version: true,
        },
      },
      candidate: true,
    },
  });

  if (!invite || !invite.candidate_id || !invite.candidate) {
    throw new Error("Invite is not ready to start.");
  }

  if (invite.assessment_id) {
    await prisma.campaignInvite.update({
      where: { id: invite.id },
      data: {
        started_at: invite.started_at ?? new Date(),
        status: invite.status === "SENT" ? "STARTED" : invite.status,
      },
    });

    return hydrate_assessment_session(input.invite_token);
  }

  const sections_snapshot = resolve_section_snapshots(
    invite.campaign.assessment_version.sections_snapshot,
    invite.campaign.assessment_version.scoring_config_snapshot,
    invite.campaign.role_family_id,
  ).filter((section) => section.enabled);
  const assessment = await prisma.assessment.create({
    data: {
      assessment_version_id: invite.campaign.assessment_version_id,
      campaign_id: invite.campaign.id,
      candidate_id: invite.candidate_id,
      org_id: invite.campaign.org_id,
      quality_flags: [] as Prisma.InputJsonValue,
      role_family_id: invite.campaign.role_family_id,
      runtime_metadata: to_json_input(input.runtime_metadata ?? {}),
      started_at: new Date(),
      status: AssessmentStatus.IN_PROGRESS,
    },
  });

  for (const section of sections_snapshot.sort((left, right) => left.order - right.order)) {
    const items = await select_items_for_section({
      candidate_id: invite.candidate_id,
      item_count: section.item_count,
      item_type_filters: section.item_type_filters as ItemType[],
      layer_code: section.layer_code,
      tag_filters: section.tag_filters,
    });

    await prisma.assessmentSection.create({
      data: {
        assessment_id: assessment.id,
        item_ids_snapshot: to_json_input(items.map((item) => item.id)),
        items_presented: items.length,
        layer_id: items[0]?.layer_id ?? (await get_layer_id_by_code(section.layer_code)),
        runtime_config_snapshot: to_json_input(section),
        section_order: section.order,
        time_limit_seconds: section.time_limit_seconds ?? null,
      },
    });

    const now = new Date();
    const total_administrations = await prisma.assessment.count({
      where: {
        deleted_at: null,
        assessment_version_id: invite.campaign.assessment_version_id,
      },
    });
    for (const item of items) {
      const next_exposure = item.exposure_count + 1;
      const projected_exposure_pct = Number((((next_exposure / Math.max(total_administrations, 1)) * 100) || 0).toFixed(1));
      await prisma.item.update({
        where: { id: item.id },
        data: {
          exposure_count: next_exposure,
          is_active: projected_exposure_pct >= item.max_exposure_pct ? false : item.is_active,
          last_used_at: now,
          review_status: projected_exposure_pct >= item.max_exposure_pct ? "RETIRED" : item.review_status,
        },
      });
    }
  }

  await prisma.campaignInvite.update({
    where: { id: invite.id },
    data: {
      assessment_id: assessment.id,
      started_at: new Date(),
      status: "STARTED",
    },
  });

  return hydrate_assessment_session(input.invite_token);
}

export async function record_assessment_consent(input: {
  consent_text: string;
  invite_token: string;
  ip_address?: string | null;
}) {
  const invite = await prisma.campaignInvite.findUnique({
    where: { invite_token: input.invite_token },
    include: {
      assessment: true,
      candidate: true,
    },
  });

  if (!invite?.assessment || !invite.candidate) {
    throw new Error("Assessment has not been started.");
  }

  const consent_hash = createHash("sha256").update(input.consent_text).digest("hex");

  await prisma.assessment.update({
    where: { id: invite.assessment.id },
    data: {
      consent_given_at: new Date(),
    },
  });

  await prisma.consentRecord.upsert({
    where: {
      user_id_assessment_id: {
        assessment_id: invite.assessment.id,
        user_id: invite.candidate.id,
      },
    },
    create: {
      assessment_id: invite.assessment.id,
      consent_text_hash: consent_hash,
      ip_address: input.ip_address ?? null,
      user_id: invite.candidate.id,
    },
    update: {
      consent_text_hash: consent_hash,
      consented_at: new Date(),
      ip_address: input.ip_address ?? null,
    },
  });
}

export async function save_assessment_response(input: {
  invite_token: string;
  item_id: string;
  response_time_seconds: number;
  response_value: unknown;
  runtime_metadata?: Record<string, unknown>;
  section_id: string;
  sequence_number: number;
}) {
  const invite = await prisma.campaignInvite.findUnique({
    where: { invite_token: input.invite_token },
    include: {
      assessment: {
        include: {
          sections: {
            include: {
              responses: {
                orderBy: { sequence_number: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!invite?.assessment) {
    throw new Error("Assessment not found.");
  }

  await assert_within_time_cap(invite.assessment.started_at, invite.assessment.assessment_version_id, invite.id, invite.assessment.id);

  const assessment = invite.assessment;
  const section = assessment.sections.find((entry) => entry.id === input.section_id);

  if (!section) {
    throw new Error("Assessment section not found.");
  }

  const existing_response = await prisma.response.findFirst({
    where: {
      assessment_id: assessment.id,
      item_id: input.item_id,
      section_id: input.section_id,
    },
  });

  if (existing_response) {
    await prisma.response.update({
      where: { id: existing_response.id },
      data: {
        is_flagged: input.response_time_seconds < 3,
        response_time_seconds: input.response_time_seconds,
        response_value: input.response_value as Prisma.InputJsonValue,
      },
    });
  } else {
    await prisma.response.create({
      data: {
        assessment_id: assessment.id,
        is_flagged: input.response_time_seconds < 3,
        item_id: input.item_id,
        response_time_seconds: input.response_time_seconds,
        response_value: input.response_value as Prisma.InputJsonValue,
        section_id: input.section_id,
        sequence_number: input.sequence_number,
      },
    });
  }

  const section_snapshot_count = Array.isArray(section.item_ids_snapshot) ? section.item_ids_snapshot.length : 0;
  const answered_count = await prisma.response.count({
    where: {
      assessment_id: assessment.id,
      section_id: input.section_id,
    },
  });

  await prisma.assessmentSection.update({
    where: { id: input.section_id },
    data: {
      items_answered: answered_count,
      completed_at: answered_count >= section_snapshot_count ? new Date() : null,
      started_at: section.started_at ?? new Date(),
      status: answered_count >= section_snapshot_count ? "COMPLETED" : "IN_PROGRESS",
    },
  });

  const quality_flags = await recompute_quality_flags(assessment.id);

  await prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      quality_flags: to_json_input(quality_flags),
      runtime_metadata: merge_runtime_metadata(assessment.runtime_metadata, input.runtime_metadata),
      status: quality_flags.length > 3 ? "INVALIDATED" : "IN_PROGRESS",
    },
  });

  await prisma.campaignInvite.update({
    where: { id: invite.id },
    data: {
      status: CampaignInviteStatus.IN_PROGRESS,
    },
  });
}

export async function update_assessment_heartbeat(input: {
  invite_token: string;
  runtime_metadata?: Record<string, unknown>;
}) {
  const invite = await prisma.campaignInvite.findUnique({
    where: { invite_token: input.invite_token },
    include: {
      assessment: true,
    },
  });

  if (!invite?.assessment) {
    throw new Error("Assessment not found.");
  }

  await assert_within_time_cap(invite.assessment.started_at, invite.assessment.assessment_version_id, invite.id, invite.assessment.id);

  await prisma.assessment.update({
    where: { id: invite.assessment.id },
    data: {
      runtime_metadata: merge_runtime_metadata(invite.assessment.runtime_metadata, {
        ...input.runtime_metadata,
        heartbeat_at: new Date().toISOString(),
      }),
    },
  });
}

export async function complete_assessment_from_invite(invite_token: string) {
  const invite = await prisma.campaignInvite.findUnique({
    where: { invite_token },
    include: {
      assessment: {
        include: {
          sections: true,
        },
      },
    },
  });

  if (!invite?.assessment) {
    throw new Error("Assessment not found.");
  }

  await assert_within_time_cap(invite.assessment.started_at, invite.assessment.assessment_version_id, invite.id, invite.assessment.id);

  const total_time_seconds = invite.assessment.started_at
    ? Math.max(0, Math.round((Date.now() - invite.assessment.started_at.getTime()) / 1000))
    : null;
  const quality_flags = as_record_array(invite.assessment.quality_flags);
  const status = quality_flags.length > 3 ? "INVALIDATED" : "COMPLETED";

  await prisma.assessment.update({
    where: { id: invite.assessment.id },
    data: {
      completed_at: new Date(),
      status,
      total_time_seconds,
    },
  });

  await prisma.campaignInvite.update({
    where: { id: invite.id },
    data: {
      completed_at: new Date(),
      status: status === "COMPLETED" ? "COMPLETED" : "EXPIRED",
    },
  });

  return hydrate_assessment_session(invite_token);
}

async function select_items_for_section(input: {
  candidate_id: string;
  item_count: number;
  item_type_filters: ItemType[];
  layer_code: string;
  tag_filters?: Record<string, string>;
}) {
  const layer = await prisma.assessmentLayer.findFirst({
    where: {
      code: input.layer_code as import("@prisma/client").AssessmentLayerCode,
    },
  });

  if (!layer) {
    return [];
  }

  const recent_item_ids = (
    await prisma.response.findMany({
      where: {
        assessment: {
          candidate_id: input.candidate_id,
          created_at: {
            gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
          },
        },
      },
      select: {
        item_id: true,
      },
    })
  ).map((response) => response.item_id);

  // Base query: approved, active items for this layer and type
  const base_where = {
    deleted_at: null,
    is_active: true,
    item_type: { in: input.item_type_filters },
    layer_id: layer.id,
    review_status: "APPROVED" as const,
  };

  // First try: exclude recently used items
  let items = await prisma.item.findMany({
    where: { ...base_where, id: { notIn: recent_item_ids } },
    orderBy: [{ exposure_count: "asc" }, { updated_at: "desc" }],
  });

  // Apply tag filters if present
  if (input.tag_filters) {
    const tag_filtered = items.filter((item) => {
      const tags = (item.tags as Record<string, unknown> | null) ?? {};
      return Object.entries(input.tag_filters ?? {}).every(([key, value]) => tags[key] === value);
    });
    // Only use tag-filtered results if enough items; otherwise drop tag filter
    if (tag_filtered.length >= input.item_count) {
      items = tag_filtered;
    }
  }

  // Fallback: if not enough items after excluding recent, include all items
  if (items.length < input.item_count) {
    items = await prisma.item.findMany({
      where: base_where,
      orderBy: [{ exposure_count: "asc" }, { updated_at: "desc" }],
    });
  }

  return shuffle(items).slice(0, input.item_count);
}

async function recompute_quality_flags(assessment_id: string) {
  const responses = await prisma.response.findMany({
    where: { assessment_id },
    orderBy: { sequence_number: "asc" },
    include: {
      item: true,
    },
  });

  const flags: Array<Record<string, unknown>> = [];

  for (const response of responses) {
    if ((response.response_time_seconds ?? 0) > 0 && (response.response_time_seconds ?? 0) < 3) {
      flags.push({
        item_id: response.item_id,
        reason: "speed_anomaly",
        response_time_seconds: response.response_time_seconds,
      });
    }
  }

  const likert_numeric = responses
    .filter((response) => response.item.item_type === "LIKERT")
    .map((response) => Number(response.response_value));

  if (likert_numeric.length >= 6) {
    const last_six = likert_numeric.slice(-6);
    if (new Set(last_six).size === 1) {
      flags.push({
        reason: "straight_lining",
        value: last_six[0],
      });
    }
  }

  if (likert_numeric.length >= 8 && (likert_numeric.every((value) => value === 1) || likert_numeric.every((value) => value === 5))) {
    flags.push({
      reason: "extreme_responding",
    });
  }

  return flags;
}

async function get_layer_id_by_code(layer_code: string) {
  const layer = await prisma.assessmentLayer.findFirst({
    where: {
      code: layer_code as import("@prisma/client").AssessmentLayerCode,
    },
  });

  if (!layer) {
    throw new Error("Layer not found.");
  }

  return layer.id;
}

function merge_runtime_metadata(existing: Prisma.JsonValue | null, incoming?: Record<string, unknown>) {
  const current = as_record(existing);
  return {
    ...current,
    ...(incoming ?? {}),
  } as Prisma.InputJsonValue;
}

function serialize_public_item(item: {
  id: string;
  item_options: Array<{ display_order: number; is_correct: boolean; option_text: string; score_weight: number }>;
  item_type: ItemType;
  options: Prisma.JsonValue;
  scoring_key: Prisma.JsonValue;
  stem: string;
  tags: Prisma.JsonValue;
  time_limit_seconds: number | null;
}): AssessmentPublicItem {
  return {
    id: item.id,
    item_type: item.item_type,
    options: normalize_item_options(item.options, item.item_options),
    scoring_key: as_record_or_null(item.scoring_key),
    stem: strip_seed_markers(item.stem),
    tags: as_record_or_null(item.tags),
    time_limit_seconds: item.time_limit_seconds,
  };
}

function strip_seed_markers(stem: string): string {
  return stem
    .replace(/\s*\[(?:Seed|Exp|Variant|Rank|Timed|Sim|Pair|Leadership self-SJT|SJT|Expanded)\s*\d*\]\s*/gi, "")
    .trim();
}

function shuffle<T>(values: T[]) {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap_index = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap_index]] = [copy[swap_index]!, copy[index]!];
  }

  return copy;
}

function as_record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function as_record_array(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function as_record_or_null(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function as_string_array(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function to_json_input(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function resolve_section_snapshots(
  sections_snapshot: Prisma.JsonValue,
  scoring_config_snapshot: Prisma.JsonValue,
  role_family_id: string,
): SectionSnapshot[] {
  const base_sections = Array.isArray(sections_snapshot) ? (sections_snapshot as SectionSnapshot[]) : [];
  const scoring_config = as_record(scoring_config_snapshot);
  const role_family_overrides = as_record(scoring_config.role_family_overrides);
  const current_override = as_record(role_family_overrides[role_family_id]);
  const section_overrides = as_record(current_override.section_overrides);

  return base_sections.map((section) => {
    const override = as_record(section_overrides[section.layer_code]);
    return {
      ...section,
      ...override,
      item_type_filters: Array.isArray(override.item_type_filters) ? as_string_array(override.item_type_filters) : section.item_type_filters,
      tag_filters: as_record_or_null(override.tag_filters) ? (as_record_or_null(override.tag_filters) as Record<string, string>) : section.tag_filters,
      q_sort_distribution: as_record_or_null(override.q_sort_distribution)
        ? (as_record_or_null(override.q_sort_distribution) as Record<string, number>)
        : section.q_sort_distribution,
    };
  });
}

async function assert_within_time_cap(
  started_at: Date | null,
  assessment_version_id: string,
  invite_id: string,
  assessment_id: string,
) {
  if (!started_at) {
    return;
  }

  const assessment_version = await prisma.assessmentVersion.findUnique({
    where: { id: assessment_version_id },
    select: { scoring_config_snapshot: true },
  });
  const scoring_config = as_record(assessment_version?.scoring_config_snapshot);
  const cap_seconds =
    typeof scoring_config.total_battery_time_cap_seconds === "number" ? Number(scoring_config.total_battery_time_cap_seconds) : null;

  if (!cap_seconds) {
    return;
  }

  const elapsed_seconds = Math.max(0, Math.round((Date.now() - started_at.getTime()) / 1000));

  if (elapsed_seconds <= cap_seconds) {
    return;
  }

  await prisma.assessment.update({
    where: { id: assessment_id },
    data: {
      completed_at: new Date(),
      status: AssessmentStatus.EXPIRED,
      total_time_seconds: elapsed_seconds,
    },
  });

  await prisma.campaignInvite.update({
    where: { id: invite_id },
    data: {
      completed_at: new Date(),
      status: CampaignInviteStatus.EXPIRED,
    },
  });

  throw new Error("Assessment time cap exceeded.");
}
