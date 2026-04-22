import { RaterRelationship } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { compute_icc, normalize_likert_to_100 } from "@/lib/insight-utils";
import { as_number, as_record, as_string } from "@/lib/scoring/utils";

export const multi_rater_settings_schema = z.object({
  blind_spot_flag_threshold: z.number().min(0.5).max(3).default(1.5),
  icc_threshold: z.number().min(0.4).max(0.95).default(0.7),
  max_ratees_per_rater: z.number().int().min(1).max(20).default(8),
  max_raters_per_subject: z.number().int().min(4).max(12).default(8),
  min_raters_per_subject: z.number().int().min(4).max(8).default(4),
});

export const multi_rater_cycle_schema = z.object({
  assessment_id: z.string().min(1),
  assignments: z
    .array(
      z.object({
        rater_id: z.string().min(1),
        relationship: z.nativeEnum(RaterRelationship),
      }),
    )
    .min(4),
  subject_id: z.string().min(1),
});

export const multi_rater_calibration_schema = z.object({
  assignment_ids: z.array(z.string().min(1)).min(1),
  calibration_completed: z.boolean(),
});

export const rater_submission_schema = z.object({
  assignment_id: z.string().min(1),
  mark_completed: z.boolean().default(true),
  narrative_comments: z.array(
    z.object({
      item_id: z.string().min(1),
      comment: z.string().max(2000),
    }),
  ).optional(),
  responses: z
    .array(
      z.object({
        item_id: z.string().min(1),
        response_time_seconds: z.number().nonnegative().default(15),
        response_value: z.number().int().min(1).max(5),
      }),
    )
    .min(1),
});

export async function get_multi_rater_snapshot(org_id: string) {
  const [organization, subjects, raters, assignments, rater_items, assessments] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org_id },
      select: { settings: true },
    }),
    prisma.user.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        org_id,
        role: {
          in: ["MANAGER", "HR_ADMIN", "SUPER_ADMIN"],
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
      },
    }),
    prisma.user.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        org_id,
        role: {
          in: ["RATER", "MANAGER", "HR_ADMIN", "SUPER_ADMIN"],
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
      },
    }),
    prisma.raterAssignment.findMany({
      where: {
        deleted_at: null,
        assessment: {
          org_id,
        },
      },
      include: {
        assessment: {
          include: {
            role_family: true,
          },
        },
        rater: true,
        rater_responses: {
          where: { deleted_at: null },
        },
        subject: true,
      },
      orderBy: [{ created_at: "desc" }],
    }),
    get_rater_items(),
    prisma.assessment.findMany({
      where: {
        deleted_at: null,
        org_id,
        status: "COMPLETED",
      },
      include: {
        candidate: true,
        role_family: true,
      },
      orderBy: [{ completed_at: "desc" }],
      take: 30,
    }),
  ]);
  const settings = normalize_multi_rater_settings(organization?.settings);
  const icc_summary = await build_icc_summary(assignments, settings.icc_threshold);

  return {
    assignments: assignments.map((assignment) => ({
      assessment_id: assignment.assessment_id,
      assignment_id: assignment.id,
      calibration_completed: assignment.calibration_completed,
      completed_response_count: assignment.rater_responses.length,
      relationship: assignment.relationship,
      rater_name: assignment.rater.name,
      role_family_name: assignment.assessment.role_family.name,
      status: assignment.status,
      subject_name: assignment.subject.name,
    })),
    assessments: assessments.map((assessment) => ({
      assessment_id: assessment.id,
      candidate_name: assessment.candidate.name,
      role_family_name: assessment.role_family.name,
      subject_id: assessment.candidate_id,
    })),
    icc_summary,
    rater_items: rater_items.map((item) => ({
      id: item.id,
      stem: item.stem,
      sub_dimension_name: item.sub_dimension?.name ?? "Unknown",
    })),
    raters,
    settings,
    subjects,
  };
}

export async function update_multi_rater_settings(input: {
  data: z.infer<typeof multi_rater_settings_schema>;
  org_id: string;
}) {
  const organization = await prisma.organization.findUnique({
    where: { id: input.org_id },
    select: { settings: true },
  });
  const next_settings = {
    ...(as_record(organization?.settings) ?? {}),
    multi_rater_config: input.data,
  };

  await prisma.organization.update({
    where: { id: input.org_id },
    data: {
      settings: next_settings,
    },
  });

  return input.data;
}

export async function create_multi_rater_cycle(input: {
  data: z.infer<typeof multi_rater_cycle_schema>;
  org_id: string;
}) {
  const settings = normalize_multi_rater_settings(
    (
      await prisma.organization.findUnique({
        where: { id: input.org_id },
        select: { settings: true },
      })
    )?.settings,
  );
  const assessment = await prisma.assessment.findFirst({
    where: {
      deleted_at: null,
      id: input.data.assessment_id,
      org_id: input.org_id,
    },
    select: {
      candidate_id: true,
      id: true,
    },
  });

  if (!assessment || assessment.candidate_id !== input.data.subject_id) {
    throw new Error("360 assignments must be linked to a valid subject assessment.");
  }

  if (input.data.assignments.length < settings.min_raters_per_subject || input.data.assignments.length > settings.max_raters_per_subject) {
    throw new Error("The requested rater count falls outside the configured subject limits.");
  }

  if (!input.data.assignments.some((assignment) => assignment.relationship === "SELF" && assignment.rater_id === input.data.subject_id)) {
    throw new Error("A self-rating assignment is required for every 360 cycle.");
  }

  if (!input.data.assignments.some((assignment) => assignment.relationship === "PEER")) {
    throw new Error("At least one peer rater is required.");
  }

  if (!input.data.assignments.some((assignment) => assignment.relationship === "DIRECT_REPORT")) {
    throw new Error("At least one direct-report rater is required.");
  }

  if (!input.data.assignments.some((assignment) => assignment.relationship === "MANAGER")) {
    throw new Error("At least one manager rater is required.");
  }

  for (const assignment of input.data.assignments) {
    const existing_ratees = await prisma.raterAssignment.count({
      where: {
        deleted_at: null,
        rater_id: assignment.rater_id,
        status: {
          in: ["NOT_STARTED", "IN_PROGRESS"],
        },
      },
    });

    if (existing_ratees >= settings.max_ratees_per_rater) {
      throw new Error("One or more raters exceed the configured maximum ratees per cycle.");
    }

    await prisma.raterAssignment.upsert({
      where: {
        assessment_id_subject_id_rater_id_relationship: {
          assessment_id: input.data.assessment_id,
          rater_id: assignment.rater_id,
          relationship: assignment.relationship,
          subject_id: input.data.subject_id,
        },
      },
      create: {
        assessment_id: input.data.assessment_id,
        calibration_completed: assignment.relationship === "SELF",
        rater_id: assignment.rater_id,
        relationship: assignment.relationship,
        subject_id: input.data.subject_id,
      },
      update: {
        calibration_completed: assignment.relationship === "SELF" ? true : undefined,
        deleted_at: null,
      },
    });
  }
}

export async function update_rater_calibration(input: {
  calibration_completed: boolean;
  assignment_ids: string[];
  org_id: string;
}) {
  await prisma.raterAssignment.updateMany({
    where: {
      assessment: {
        org_id: input.org_id,
      },
      id: {
        in: input.assignment_ids,
      },
    },
    data: {
      calibration_completed: input.calibration_completed,
    },
  });
}

export async function get_rater_workspace(rater_id: string) {
  const assignments = await prisma.raterAssignment.findMany({
    where: {
      deleted_at: null,
      rater_id,
    },
    include: {
      assessment: {
        include: {
          role_family: true,
        },
      },
      rater_responses: {
        where: { deleted_at: null },
      },
      subject: true,
    },
    orderBy: [{ created_at: "desc" }],
  });
  const org_id = assignments[0]?.assessment?.org_id ?? null;
  const rater_items = org_id ? await get_rater_items() : [];

  return {
    assignments: assignments.map((assignment) => ({
      assessment_id: assignment.assessment_id,
      assignment_id: assignment.id,
      calibration_completed: assignment.calibration_completed,
      estimated_time_minutes: 15,
      response_count: assignment.rater_responses.length,
      role_family_name: assignment.assessment.role_family.name,
      status: assignment.status,
      subject_name: assignment.subject.name,
    })),
    rater_items: rater_items.map((item) => ({
      id: item.id,
      stem: item.stem,
      sub_dimension_name: item.sub_dimension?.name ?? "Unknown",
    })),
  };
}

export async function submit_rater_responses(input: z.infer<typeof rater_submission_schema>) {
  const assignment = await prisma.raterAssignment.findUnique({
    where: { id: input.assignment_id },
    include: {
      assessment: true,
    },
  });

  if (!assignment || assignment.deleted_at) {
    throw new Error("Rater assignment not found.");
  }

  if (assignment.relationship !== "SELF" && !assignment.calibration_completed) {
    throw new Error("Rater calibration must be completed before the 360 workflow can begin.");
  }

  for (const response of input.responses) {
    const existing = await prisma.raterResponse.findFirst({
      where: {
        deleted_at: null,
        item_id: response.item_id,
        rater_assignment_id: assignment.id,
      },
    });

    const narrative = input.narrative_comments?.find((c) => c.item_id === response.item_id);

    if (existing) {
      await prisma.raterResponse.update({
        where: { id: existing.id },
        data: {
          response_time_seconds: response.response_time_seconds,
          response_value: response.response_value,
          ...(narrative ? { narrative_comment: narrative.comment } : {}),
        },
      });
    } else {
      await prisma.raterResponse.create({
        data: {
          item_id: response.item_id,
          rater_assignment_id: assignment.id,
          response_time_seconds: response.response_time_seconds,
          response_value: response.response_value,
          ...(narrative ? { narrative_comment: narrative.comment } : {}),
        },
      });
    }
  }

  await prisma.raterAssignment.update({
    where: { id: assignment.id },
    data: {
      status: input.mark_completed ? "COMPLETED" : "IN_PROGRESS",
    },
  });

  return prisma.raterAssignment.findUnique({
    where: { id: assignment.id },
    include: {
      rater_responses: {
        where: { deleted_at: null },
      },
      subject: true,
    },
  });
}

export async function get_blind_spot_summary(subject_id: string, assessment_id: string, org_id: string) {
  const [self_scores, responses, settings] = await Promise.all([
    prisma.score.findMany({
      where: {
        assessment_id,
        deleted_at: null,
        assessment_layer: {
          code: "LEADERSHIP",
        },
        sub_dimension_id: {
          not: null,
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
          assessment: {
            org_id,
          },
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
    prisma.organization.findUnique({
      where: { id: org_id },
      select: { settings: true },
    }),
  ]);
  const threshold = normalize_multi_rater_settings(settings?.settings).blind_spot_flag_threshold * 20;
  const grouped = new Map<string, number[]>();

  for (const response of responses) {
    const sub_dimension_name = response.item.sub_dimension?.name;
    const value = typeof response.response_value === "number" ? response.response_value : null;

    if (!sub_dimension_name || value === null || response.rater_assignment.relationship === "SELF") {
      continue;
    }

    grouped.set(sub_dimension_name, [...(grouped.get(sub_dimension_name) ?? []), normalize_likert_to_100(value)]);
  }

  return self_scores
    .map((score) => {
      const name = score.sub_dimension?.name ?? "Unknown";
      const peer_values = grouped.get(name) ?? [];
      const peer_mean = peer_values.length ? peer_values.reduce((sum, value) => sum + value, 0) / peer_values.length : null;
      const self_score = score.normalized_score_0_100 ?? score.raw_score ?? 0;

      return {
        blind_spot_flag: peer_mean !== null && self_score - peer_mean > threshold,
        peer_mean: peer_mean !== null ? Number(peer_mean.toFixed(2)) : null,
        self_score: Number(self_score.toFixed(2)),
        sub_dimension_name: name,
      };
    })
    .filter((entry) => entry.peer_mean !== null);
}

function normalize_multi_rater_settings(settings: unknown) {
  const root = as_record(settings) ?? {};
  const configured = as_record(root.multi_rater_config) ?? {};

  return multi_rater_settings_schema.parse({
    blind_spot_flag_threshold: as_number(configured.blind_spot_flag_threshold) ?? 1.5,
    icc_threshold: as_number(configured.icc_threshold) ?? 0.7,
    max_ratees_per_rater: as_number(configured.max_ratees_per_rater) ?? 8,
    max_raters_per_subject: as_number(configured.max_raters_per_subject) ?? 8,
    min_raters_per_subject: as_number(configured.min_raters_per_subject) ?? 4,
  });
}

async function get_rater_items() {
  const items = await prisma.item.findMany({
    where: {
      deleted_at: null,
      is_active: true,
      assessment_layer: {
        code: "LEADERSHIP",
      },
    },
    include: {
      sub_dimension: true,
    },
    orderBy: [{ created_at: "asc" }],
  });

  return items.filter((item) => {
    const scoring_key = as_record(item.scoring_key) ?? {};
    const tags = as_record(item.tags) ?? {};
    return (as_string(scoring_key.audience) ?? as_string(tags.audience)) === "RATER";
  });
}

async function build_icc_summary(assignments: Array<{
  assessment_id: string;
  calibration_completed: boolean;
  deleted_at: Date | null;
  id: string;
  relationship: RaterRelationship;
  rater: { name: string };
  rater_id: string;
  rater_responses: Array<{ item_id: string; response_value: unknown }>;
  status: string;
  subject: { name: string };
  subject_id: string;
}>, threshold: number) {
  const grouped = new Map<string, Map<RaterRelationship, Array<(typeof assignments)[number]>>>();

  for (const assignment of assignments) {
    const subject_group = grouped.get(assignment.subject_id) ?? new Map<RaterRelationship, Array<(typeof assignments)[number]>>();
    subject_group.set(assignment.relationship, [...(subject_group.get(assignment.relationship) ?? []), assignment]);
    grouped.set(assignment.subject_id, subject_group);
  }

  return Array.from(grouped.entries()).flatMap(([subject_id, relationship_map]) =>
    Array.from(relationship_map.entries()).map(([relationship, relationship_assignments]) => {
      const item_ids = Array.from(
        new Set(
          relationship_assignments.flatMap((assignment) => assignment.rater_responses.map((response) => response.item_id)),
        ),
      );
      const matrix = item_ids.map((item_id) =>
        relationship_assignments
          .map((assignment) => assignment.rater_responses.find((response) => response.item_id === item_id))
          .map((response) => (typeof response?.response_value === "number" ? response.response_value : null))
          .filter((value): value is number => value !== null),
      );
      const icc = compute_icc(matrix.filter((row) => row.length === relationship_assignments.length));

      return {
        icc,
        relationship,
        sample_n: matrix.length,
        status: icc !== null && icc >= threshold ? "RELIABLE" : "RECALIBRATE",
        subject_id,
        subject_name: relationship_assignments[0]?.subject.name ?? "Unknown",
      };
    }),
  );
}
