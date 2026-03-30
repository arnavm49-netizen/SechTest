import { GovernanceRequestStatus, GovernanceRequestType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { as_number, as_record } from "@/lib/scoring/utils";

export const compliance_settings_schema = z.object({
  candidate_feedback_enabled: z.boolean(),
  challenge_process_enabled: z.boolean(),
  data_fiduciary_registration_required: z.boolean(),
  retention_raw_responses_months: z.number().int().min(1).max(60),
  retention_scores_years: z.number().int().min(1).max(10),
  self_service_access_enabled: z.boolean(),
});

export const governance_request_create_schema = z.object({
  assessment_id: z.string().min(1).optional(),
  request_note: z.string().min(10).max(4000),
  request_type: z.nativeEnum(GovernanceRequestType),
});

export const governance_request_review_schema = z.object({
  execute_delete: z.boolean().optional(),
  resolution_note: z.string().min(4).max(4000),
  status: z.nativeEnum(GovernanceRequestStatus),
});

export async function get_compliance_snapshot(org_id: string) {
  const [organization, consent_records, audit_logs, requests, high_stakes_assessments] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org_id },
      select: {
        dpdp_consent_template: true,
        settings: true,
      },
    }),
    prisma.consentRecord.count({
      where: {
        deleted_at: null,
        assessment: {
          org_id,
        },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        deleted_at: null,
        user: {
          org_id,
        },
      },
      include: {
        user: true,
      },
      orderBy: { timestamp: "desc" },
      take: 25,
    }),
    prisma.governanceRequest.findMany({
      where: {
        deleted_at: null,
        org_id,
      },
      include: {
        assessment: {
          include: {
            candidate: true,
          },
        },
        reviewer: true,
        user: true,
      },
      orderBy: [{ created_at: "desc" }],
      take: 40,
    }),
    prisma.assessment.findMany({
      where: {
        deleted_at: null,
        is_high_stakes: true,
        org_id,
        role_fit_results: {
          some: {
            deleted_at: null,
            recommendation: {
              in: ["DEVELOP", "POOR_FIT"],
            },
          },
        },
      },
      include: {
        candidate: true,
        role_fit_results: {
          where: { deleted_at: null },
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
      orderBy: [{ updated_at: "desc" }],
      take: 20,
    }),
  ]);
  const settings = normalize_compliance_settings(organization?.settings);

  return {
    adverse_action_notices: high_stakes_assessments.map((assessment) => ({
      assessment_id: assessment.id,
      candidate_name: assessment.candidate.name,
      recommendation: assessment.role_fit_results[0]?.recommendation ?? null,
      status: "Pending notice",
    })),
    audit_logs: audit_logs.map((log) => ({
      action: log.action,
      ip_address: log.ip_address,
      target_entity: log.target_entity,
      timestamp: log.timestamp.toISOString(),
      user_name: log.user?.name ?? "System",
    })),
    consent_record_count: consent_records,
    consent_template: organization?.dpdp_consent_template ?? "",
    requests: requests.map((request) => ({
      assessment_id: request.assessment_id,
      created_at: request.created_at.toISOString(),
      request_id: request.id,
      request_note: request.request_note,
      request_type: request.request_type,
      resolution_note: request.resolution_note,
      reviewer_name: request.reviewer?.name ?? null,
      status: request.status,
      user_name: request.user.name,
    })),
    settings,
  };
}

export async function update_compliance_settings(input: {
  data: z.infer<typeof compliance_settings_schema>;
  org_id: string;
}) {
  const organization = await prisma.organization.findUnique({
    where: { id: input.org_id },
    select: { settings: true },
  });
  const next_settings = {
    ...(as_record(organization?.settings) ?? {}),
    compliance: input.data,
    candidate_feedback_enabled: input.data.candidate_feedback_enabled,
  };

  await prisma.organization.update({
    where: { id: input.org_id },
    data: {
      settings: next_settings,
    },
  });

  return input.data;
}

export async function create_governance_request(input: {
  assessment_id?: string;
  org_id: string;
  request_note: string;
  request_type: GovernanceRequestType;
  user_id: string;
}) {
  return prisma.governanceRequest.create({
    data: {
      assessment_id: input.assessment_id ?? null,
      due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      org_id: input.org_id,
      request_note: input.request_note,
      request_type: input.request_type,
      user_id: input.user_id,
    },
  });
}

export async function review_governance_request(input: {
  execute_delete?: boolean;
  org_id: string;
  request_id: string;
  resolution_note: string;
  reviewer_id: string;
  status: GovernanceRequestStatus;
}) {
  const request = await prisma.governanceRequest.findFirst({
    where: {
      deleted_at: null,
      id: input.request_id,
      org_id: input.org_id,
    },
  });

  if (!request) {
    throw new Error("Governance request not found.");
  }

  if (input.execute_delete && request.request_type === "DELETE" && input.status === "APPROVED") {
    await anonymize_user(request.user_id);
  }

  return prisma.governanceRequest.update({
    where: { id: request.id },
    data: {
      resolution_note: input.resolution_note,
      resolved_at: new Date(),
      reviewed_at: new Date(),
      reviewed_by: input.reviewer_id,
      status: input.execute_delete && request.request_type === "DELETE" && input.status === "APPROVED" ? "COMPLETED" : input.status,
    },
  });
}

function normalize_compliance_settings(settings: unknown) {
  const root = as_record(settings) ?? {};
  const configured = as_record(root.compliance) ?? {};

  return compliance_settings_schema.parse({
    candidate_feedback_enabled:
      typeof configured.candidate_feedback_enabled === "boolean" ? configured.candidate_feedback_enabled : Boolean(root.candidate_feedback_enabled),
    challenge_process_enabled: typeof configured.challenge_process_enabled === "boolean" ? configured.challenge_process_enabled : true,
    data_fiduciary_registration_required:
      typeof configured.data_fiduciary_registration_required === "boolean" ? configured.data_fiduciary_registration_required : false,
    retention_raw_responses_months: as_number(configured.retention_raw_responses_months) ?? 12,
    retention_scores_years: as_number(configured.retention_scores_years) ?? 5,
    self_service_access_enabled: typeof configured.self_service_access_enabled === "boolean" ? configured.self_service_access_enabled : true,
  });
}

async function anonymize_user(user_id: string) {
  const requests = await prisma.governanceRequest.findMany({
    where: {
      deleted_at: null,
      user_id,
    },
    select: {
      id: true,
    },
  });

  await prisma.user.update({
    where: { id: user_id },
    data: {
      deleted_at: new Date(),
      demographic_group: null,
      department: null,
      email: `deleted+${user_id}@redacted.local`,
      is_active: false,
      job_title: null,
      name: "Deleted User",
      profile: Prisma.JsonNull,
    },
  });

  if (requests.length) {
    await prisma.governanceRequest.updateMany({
      where: {
        id: {
          in: requests.map((request) => request.id),
        },
      },
      data: {
        status: "COMPLETED",
      },
    });
  }
}
