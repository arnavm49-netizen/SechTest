import { AssessmentPurpose, CampaignInviteStatus, CampaignStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { CampaignDto, CampaignSettings } from "@/lib/campaign-types";

const reminder_schedule_schema = z.object({
  day_interval: z.number().int().min(1).max(30),
  enabled: z.boolean(),
  next_run_at: z.string().nullable().optional(),
});

const campaign_settings_schema = z.object({
  reminder_schedule: reminder_schedule_schema.optional(),
});

export const campaign_create_schema = z.object({
  assessment_version_id: z.string().min(1),
  deadline: z.string().nullable().optional(),
  invite_template: z.string().min(10),
  name: z.string().min(3).max(120),
  purpose: z.nativeEnum(AssessmentPurpose).default("HIRING"),
  reminder_template: z.string().min(10),
  role_family_id: z.string().min(1),
  settings: campaign_settings_schema.optional(),
  status: z.nativeEnum(CampaignStatus).default("DRAFT"),
});

export const campaign_update_schema = campaign_create_schema.partial().extend({
  assessment_version_id: z.string().min(1).optional(),
  invite_template: z.string().min(10).optional(),
  name: z.string().min(3).max(120).optional(),
  reminder_template: z.string().min(10).optional(),
  role_family_id: z.string().min(1).optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
});

export const campaign_invite_schema = z.object({
  candidate_ids: z.array(z.string().min(1)).default([]),
  emails: z.array(z.email()).default([]),
  expires_in_days: z.number().int().min(1).max(60).default(14),
});

export const campaign_reminder_schema = z.object({
  invite_ids: z.array(z.string().min(1)).optional(),
});

export async function list_campaigns(org_id: string): Promise<CampaignDto[]> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      deleted_at: null,
      org_id,
    },
    include: {
      assessment_version: true,
      invites: {
        where: { deleted_at: null },
        include: {
          candidate: true,
        },
        orderBy: [{ created_at: "desc" }],
      },
      role_family: true,
    },
    orderBy: [{ created_at: "desc" }],
  });

  return campaigns.map(serialize_campaign);
}

export async function create_campaign(input: {
  actor_id: string;
  data: z.infer<typeof campaign_create_schema>;
  org_id: string;
}): Promise<CampaignDto> {
  await ensure_campaign_dependencies(input.org_id, input.data.assessment_version_id, input.data.role_family_id);

  const created = await prisma.campaign.create({
    data: {
      assessment_version_id: input.data.assessment_version_id,
      created_by: input.actor_id,
      deadline: input.data.deadline ? new Date(input.data.deadline) : null,
      invite_template: input.data.invite_template,
      name: input.data.name,
      org_id: input.org_id,
      purpose: input.data.purpose,
      reminder_template: input.data.reminder_template,
      role_family_id: input.data.role_family_id,
      settings: normalize_campaign_settings(input.data.settings) as Prisma.InputJsonValue,
      status: input.data.status,
    },
    include: {
      assessment_version: true,
      invites: {
        where: { deleted_at: null },
        include: { candidate: true },
      },
      role_family: true,
    },
  });

  return serialize_campaign(created);
}

export async function update_campaign(input: {
  campaign_id: string;
  data: z.infer<typeof campaign_update_schema>;
  org_id: string;
}): Promise<CampaignDto> {
  const campaign = await prisma.campaign.findFirst({
    where: {
      deleted_at: null,
      id: input.campaign_id,
      org_id: input.org_id,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (input.data.assessment_version_id || input.data.role_family_id) {
    await ensure_campaign_dependencies(
      input.org_id,
      input.data.assessment_version_id ?? campaign.assessment_version_id,
      input.data.role_family_id ?? campaign.role_family_id,
    );
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      assessment_version_id: input.data.assessment_version_id ?? campaign.assessment_version_id,
      deadline: input.data.deadline === undefined ? campaign.deadline : input.data.deadline ? new Date(input.data.deadline) : null,
      invite_template: input.data.invite_template ?? campaign.invite_template,
      name: input.data.name ?? campaign.name,
      reminder_template: input.data.reminder_template ?? campaign.reminder_template,
      role_family_id: input.data.role_family_id ?? campaign.role_family_id,
      settings:
        input.data.settings === undefined
          ? to_nullable_json_input(campaign.settings)
          : (normalize_campaign_settings(input.data.settings) as Prisma.InputJsonValue),
      status: input.data.status ?? campaign.status,
    },
    include: {
      assessment_version: true,
      invites: {
        where: { deleted_at: null },
        include: { candidate: true },
      },
      role_family: true,
    },
  });

  return serialize_campaign(updated);
}

export async function create_campaign_invites(input: {
  campaign_id: string;
  data: z.infer<typeof campaign_invite_schema>;
  org_id: string;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      deleted_at: null,
      id: input.campaign_id,
      org_id: input.org_id,
    },
    include: {
      invites: {
        where: { deleted_at: null },
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const unique_candidate_ids = Array.from(new Set(input.data.candidate_ids));
  const unique_emails = Array.from(new Set(input.data.emails.map((email) => email.toLowerCase())));
  const users = await prisma.user.findMany({
    where: {
      deleted_at: null,
      is_active: true,
      org_id: input.org_id,
      OR: [
        unique_candidate_ids.length ? { id: { in: unique_candidate_ids } } : undefined,
        unique_emails.length ? { email: { in: unique_emails } } : undefined,
      ].filter(Boolean) as Prisma.UserWhereInput[],
      role: UserRole.CANDIDATE,
    },
  });

  const users_by_id = new Map(users.map((user) => [user.id, user]));
  const users_by_email = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const existing_candidate_ids = new Set(campaign.invites.map((invite) => invite.candidate_id).filter(Boolean));
  const existing_emails = new Set(campaign.invites.map((invite) => invite.email.toLowerCase()));
  const created_invites: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const expires_at = new Date(Date.now() + input.data.expires_in_days * 24 * 60 * 60 * 1000);

  for (const candidate_id of unique_candidate_ids) {
    const user = users_by_id.get(candidate_id);

    if (!user) {
      errors.push(`Candidate ${candidate_id} was not found or is inactive.`);
      continue;
    }

    if (existing_candidate_ids.has(user.id) || existing_emails.has(user.email.toLowerCase())) {
      skipped.push(user.email);
      continue;
    }

    await prisma.campaignInvite.create({
      data: {
        campaign_id: campaign.id,
        candidate_id: user.id,
        email: user.email,
        expires_at,
        invite_token: build_invite_token(campaign.id, user.email),
        invited_at: new Date(),
        status: CampaignInviteStatus.SENT,
      },
    });

    existing_candidate_ids.add(user.id);
    existing_emails.add(user.email.toLowerCase());
    created_invites.push(user.email);
  }

  for (const email of unique_emails) {
    const user = users_by_email.get(email);

    if (!user) {
      errors.push(`No active candidate user found for ${email}.`);
      continue;
    }

    if (existing_candidate_ids.has(user.id) || existing_emails.has(user.email.toLowerCase())) {
      skipped.push(user.email);
      continue;
    }

    await prisma.campaignInvite.create({
      data: {
        campaign_id: campaign.id,
        candidate_id: user.id,
        email: user.email,
        expires_at,
        invite_token: build_invite_token(campaign.id, user.email),
        invited_at: new Date(),
        status: CampaignInviteStatus.SENT,
      },
    });

    existing_candidate_ids.add(user.id);
    existing_emails.add(user.email.toLowerCase());
    created_invites.push(user.email);
  }

  return {
    created_invites,
    errors,
    skipped,
  };
}

export async function send_campaign_reminders(input: {
  campaign_id: string;
  invite_ids?: string[];
  org_id: string;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      deleted_at: null,
      id: input.campaign_id,
      org_id: input.org_id,
    },
    include: {
      invites: {
        where: {
          deleted_at: null,
          completed_at: null,
          status: {
            in: [CampaignInviteStatus.SENT, CampaignInviteStatus.STARTED, CampaignInviteStatus.IN_PROGRESS],
          },
        },
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const target_invites = input.invite_ids?.length
    ? campaign.invites.filter((invite) => input.invite_ids?.includes(invite.id))
    : campaign.invites;

  for (const invite of target_invites) {
    await prisma.campaignInvite.update({
      where: { id: invite.id },
      data: {
        last_reminded_at: new Date(),
        reminder_count: {
          increment: 1,
        },
      },
    });
  }

  const settings = normalize_campaign_settings(campaign.settings);
  const schedule = settings.reminder_schedule;

  if (schedule?.enabled) {
    settings.reminder_schedule = {
      ...schedule,
      next_run_at: new Date(Date.now() + schedule.day_interval * 24 * 60 * 60 * 1000).toISOString(),
    };

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        settings: settings as Prisma.InputJsonValue,
      },
    });
  }

  return {
    reminded_count: target_invites.length,
  };
}

export function parse_campaign_emails(content: string) {
  return Array.from(
    new Set(
      content
        .split(/[\n,;\s]+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function serialize_campaign(campaign: {
  assessment_version: { id: string; version_label: string };
  created_at: Date;
  deadline: Date | null;
  id: string;
  invite_template: string;
  invites: Array<{
    candidate: { id: string; name: string } | null;
    candidate_id: string | null;
    completed_at: Date | null;
    email: string;
    expires_at: Date | null;
    id: string;
    invite_token: string;
    invited_at: Date | null;
    last_reminded_at: Date | null;
    reminder_count: number;
    started_at: Date | null;
    status: CampaignInviteStatus;
  }>;
  name: string;
  reminder_template: string;
  role_family: { id: string; name: string };
  settings: Prisma.JsonValue | null;
  status: CampaignStatus;
  updated_at: Date;
}): CampaignDto {
  const metrics = {
    completed: campaign.invites.filter((invite) => invite.status === CampaignInviteStatus.COMPLETED).length,
    in_progress: campaign.invites.filter((invite) => invite.status === CampaignInviteStatus.STARTED || invite.status === CampaignInviteStatus.IN_PROGRESS)
      .length,
    pending: campaign.invites.filter((invite) => invite.status === CampaignInviteStatus.SENT || invite.status === CampaignInviteStatus.DRAFT).length,
    total: campaign.invites.length,
  };

  return {
    assessment_version_id: campaign.assessment_version.id,
    assessment_version_label: campaign.assessment_version.version_label,
    created_at: campaign.created_at.toISOString(),
    deadline: campaign.deadline?.toISOString() ?? null,
    id: campaign.id,
    invite_template: campaign.invite_template,
    invites: campaign.invites.map((invite) => ({
      candidate_id: invite.candidate_id,
      candidate_name: invite.candidate?.name ?? null,
      completed_at: invite.completed_at?.toISOString() ?? null,
      email: invite.email,
      expires_at: invite.expires_at?.toISOString() ?? null,
      id: invite.id,
      invite_token: invite.invite_token,
      invited_at: invite.invited_at?.toISOString() ?? null,
      last_reminded_at: invite.last_reminded_at?.toISOString() ?? null,
      reminder_count: invite.reminder_count,
      started_at: invite.started_at?.toISOString() ?? null,
      status: invite.status,
    })),
    metrics,
    name: campaign.name,
    reminder_template: campaign.reminder_template,
    role_family_id: campaign.role_family.id,
    role_family_name: campaign.role_family.name,
    settings: normalize_campaign_settings(campaign.settings),
    status: campaign.status,
    updated_at: campaign.updated_at.toISOString(),
  };
}

function normalize_campaign_settings(value: unknown): CampaignSettings {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const reminder_schedule =
    record.reminder_schedule && typeof record.reminder_schedule === "object" && !Array.isArray(record.reminder_schedule)
      ? (record.reminder_schedule as Record<string, unknown>)
      : null;

  return {
    reminder_schedule: reminder_schedule
      ? {
          day_interval:
            typeof reminder_schedule.day_interval === "number" ? Number(reminder_schedule.day_interval) : 2,
          enabled: typeof reminder_schedule.enabled === "boolean" ? reminder_schedule.enabled : false,
          next_run_at:
            typeof reminder_schedule.next_run_at === "string" || reminder_schedule.next_run_at === null
              ? (reminder_schedule.next_run_at as string | null)
              : null,
        }
      : undefined,
  };
}

async function ensure_campaign_dependencies(org_id: string, assessment_version_id: string, role_family_id: string) {
  const [assessment_version, role_family] = await Promise.all([
    prisma.assessmentVersion.findFirst({
      where: {
        deleted_at: null,
        id: assessment_version_id,
        org_id,
      },
    }),
    prisma.roleFamily.findFirst({
      where: {
        deleted_at: null,
        id: role_family_id,
        org_id,
      },
    }),
  ]);

  if (!assessment_version) {
    throw new Error("Assessment version not found.");
  }

  if (!role_family) {
    throw new Error("Role family not found.");
  }
}

function build_invite_token(campaign_id: string, email: string) {
  const safe_email = email.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${campaign_id.slice(0, 6)}-${safe_email}-${Math.random().toString(36).slice(2, 10)}`;
}

function to_nullable_json_input(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
