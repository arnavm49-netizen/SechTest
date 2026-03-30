import type { CampaignInviteStatus, CampaignStatus } from "@prisma/client";

export type CampaignReminderSchedule = {
  day_interval: number;
  enabled: boolean;
  next_run_at?: string | null;
};

export type CampaignSettings = {
  reminder_schedule?: CampaignReminderSchedule;
};

export type CampaignInviteDto = {
  candidate_id: string | null;
  candidate_name: string | null;
  completed_at: string | null;
  email: string;
  expires_at: string | null;
  id: string;
  invite_token: string;
  invited_at: string | null;
  last_reminded_at: string | null;
  reminder_count: number;
  started_at: string | null;
  status: CampaignInviteStatus;
};

export type CampaignDto = {
  assessment_version_id: string;
  assessment_version_label: string;
  created_at: string;
  deadline: string | null;
  id: string;
  invite_template: string;
  invites: CampaignInviteDto[];
  metrics: {
    completed: number;
    in_progress: number;
    pending: number;
    total: number;
  };
  name: string;
  reminder_template: string;
  role_family_id: string;
  role_family_name: string;
  settings: CampaignSettings;
  status: CampaignStatus;
  updated_at: string;
};
