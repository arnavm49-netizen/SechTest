import { randomBytes, randomUUID } from "crypto";
import { CampaignInviteStatus, CampaignStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { hash_password } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { resolve_public_app_url } from "@/lib/public-app-url";

export const create_administered_test_schema = z.object({
  assessment_version_id: z.string().min(1),
  candidate_email: z.string().email(),
  candidate_name: z.string().min(2).max(120),
  expires_in_days: z.number().int().min(1).max(30).default(14),
  role_family_id: z.string().min(1),
});

export type AdministeredTestDto = {
  assessment_id: string | null;
  assessment_link: string;
  assessment_version_label: string;
  candidate_email: string;
  candidate_name: string;
  campaign_id: string;
  campaign_name: string;
  completed_at: string | null;
  created_at: string;
  expires_at: string | null;
  id: string;
  invite_token: string;
  role_family_name: string;
  status: CampaignInviteStatus;
};

export async function list_administered_tests(org_id: string, headers?: Headers): Promise<AdministeredTestDto[]> {
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
          assessment: true,
          candidate: true,
        },
        orderBy: [{ created_at: "desc" }],
      },
      role_family: true,
    },
    orderBy: [{ created_at: "desc" }],
  });

  return campaigns
    .filter((campaign) => is_administered_campaign(campaign.settings))
    .flatMap((campaign) =>
      campaign.invites.map((invite) =>
        serialize_administered_test({
          app_url: resolve_public_app_url(headers),
          assessment_version_label: campaign.assessment_version.version_label,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          created_at: campaign.created_at,
          invite,
          role_family_name: campaign.role_family.name,
        }),
      ),
    );
}

export async function create_administered_test(input: {
  actor_id: string;
  app_url?: string;
  data: z.infer<typeof create_administered_test_schema>;
  org_id: string;
}): Promise<AdministeredTestDto> {
  const candidate_email = input.data.candidate_email.trim().toLowerCase();
  const candidate_name = input.data.candidate_name.trim();
  const expires_at = new Date(Date.now() + input.data.expires_in_days * 24 * 60 * 60 * 1000);

  const [assessment_version, role_family, existing_user] = await Promise.all([
    prisma.assessmentVersion.findFirst({
      where: {
        deleted_at: null,
        id: input.data.assessment_version_id,
        org_id: input.org_id,
      },
    }),
    prisma.roleFamily.findFirst({
      where: {
        deleted_at: null,
        id: input.data.role_family_id,
        org_id: input.org_id,
      },
    }),
    prisma.user.findFirst({
      where: {
        deleted_at: null,
        email: candidate_email,
        org_id: input.org_id,
      },
    }),
  ]);

  if (!assessment_version) {
    throw new Error("Select a valid assessment version.");
  }

  if (!role_family) {
    throw new Error("Select a valid role family.");
  }

  if (existing_user && existing_user.role !== UserRole.CANDIDATE) {
    throw new Error("That email already belongs to a non-candidate user.");
  }

  const candidate =
    existing_user ??
    (await prisma.user.create({
      data: {
        email: candidate_email,
        name: candidate_name,
        org_id: input.org_id,
        password_hash: await hash_password(randomBytes(18).toString("base64url")),
        profile: {
          created_via: "administered_test",
          seeded: false,
        },
        role: UserRole.CANDIDATE,
      },
    }));

  const campaign = await prisma.campaign.create({
    data: {
      assessment_version_id: assessment_version.id,
      created_by: input.actor_id,
      deadline: expires_at,
      invite_template: "Please complete your administered D&H Secheron psychometric assessment using the secure link below.",
      name: `Administered Test · ${candidate_name} · ${role_family.name}`,
      org_id: input.org_id,
      reminder_template: "Reminder: your administered D&H Secheron psychometric assessment is still pending.",
      role_family_id: role_family.id,
      settings: {
        administered_mode: true,
        candidate_email,
        candidate_name,
        created_at: new Date().toISOString(),
        expires_in_days: input.data.expires_in_days,
      } satisfies Prisma.InputJsonValue,
      status: CampaignStatus.ACTIVE,
    },
  });

  const invite = await prisma.campaignInvite.create({
    data: {
      campaign_id: campaign.id,
      candidate_id: candidate.id,
      email: candidate.email,
      expires_at,
      invite_token: build_administered_invite_token(campaign.id, candidate.email),
      invited_at: new Date(),
      status: CampaignInviteStatus.SENT,
    },
    include: {
      assessment: true,
      candidate: true,
    },
  });

  return serialize_administered_test({
    app_url: input.app_url,
    assessment_version_label: assessment_version.version_label,
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    created_at: campaign.created_at,
    invite,
    role_family_name: role_family.name,
  });
}

function build_administered_invite_token(campaign_id: string, email: string) {
  const safe_email = email.split("@")[0]?.replace(/[^a-z0-9]/gi, "-").toLowerCase() ?? "candidate";
  return `${campaign_id.slice(0, 8)}-${safe_email}-${randomUUID().slice(0, 8)}`;
}

function is_administered_campaign(value: unknown) {
  return typeof value === "object" && value !== null && "administered_mode" in value && (value as Record<string, unknown>).administered_mode === true;
}

function serialize_administered_test(input: {
  app_url?: string;
  assessment_version_label: string;
  campaign_id: string;
  campaign_name: string;
  created_at: Date;
  invite: {
    assessment: { id: string } | null;
    candidate: { name: string } | null;
    completed_at: Date | null;
    created_at: Date;
    email: string;
    expires_at: Date | null;
    id: string;
    invite_token: string;
    status: CampaignInviteStatus;
  };
  role_family_name: string;
}): AdministeredTestDto {
  return {
    assessment_id: input.invite.assessment?.id ?? null,
    assessment_link: `${(input.app_url ?? resolve_public_app_url()).replace(/\/$/, "")}/assessment/${input.invite.invite_token}`,
    assessment_version_label: input.assessment_version_label,
    candidate_email: input.invite.email,
    candidate_name: input.invite.candidate?.name ?? input.invite.email,
    campaign_id: input.campaign_id,
    campaign_name: input.campaign_name,
    completed_at: input.invite.completed_at?.toISOString() ?? null,
    created_at: input.invite.created_at.toISOString() ?? input.created_at.toISOString(),
    expires_at: input.invite.expires_at?.toISOString() ?? null,
    id: input.invite.id,
    invite_token: input.invite.invite_token,
    role_family_name: input.role_family_name,
    status: input.invite.status,
  };
}
