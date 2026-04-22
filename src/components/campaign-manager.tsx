"use client";

import type { CampaignStatus } from "@prisma/client";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssessmentVersionDto } from "@/lib/assessment-configuration-types";
import { parse_campaign_emails } from "@/lib/campaigns";
import type { CampaignDto } from "@/lib/campaign-types";
import { format_date } from "@/lib/utils";

type RoleFamilyOption = {
  id: string;
  name: string;
};

type CandidateOption = {
  email: string;
  id: string;
  name: string;
};

type CampaignForm = {
  assessment_version_id: string;
  deadline: string;
  invite_template: string;
  name: string;
  purpose: "HIRING" | "DEVELOPMENT" | "SUCCESSION";
  reminder_day_interval: number;
  reminder_enabled: boolean;
  reminder_template: string;
  role_family_id: string;
  status: CampaignStatus;
};

export function CampaignManager({
  candidates,
  initial_campaigns,
  role_families,
  versions,
}: {
  candidates: CandidateOption[];
  initial_campaigns: CampaignDto[];
  role_families: RoleFamilyOption[];
  versions: AssessmentVersionDto[];
}) {
  const [campaigns, set_campaigns] = useState(initial_campaigns);
  const [selected_campaign_id, set_selected_campaign_id] = useState(initial_campaigns[0]?.id ?? "");
  const [selected_candidate_ids, set_selected_candidate_ids] = useState<string[]>([]);
  const [bulk_email_content, set_bulk_email_content] = useState("");
  const [message, set_message] = useState("");
  const [invite_feedback, set_invite_feedback] = useState<string[]>([]);
  const [is_pending, start_transition] = useTransition();

  const selected_campaign = useMemo(() => {
    if (!selected_campaign_id) {
      return null;
    }

    return campaigns.find((campaign) => campaign.id === selected_campaign_id) ?? null;
  }, [campaigns, selected_campaign_id]);
  const [form, set_form] = useState<CampaignForm>(() => build_form_state(initial_campaigns[0] ?? null, role_families, versions));

  function select_campaign(campaign: CampaignDto) {
    set_selected_campaign_id(campaign.id);
    set_form(build_form_state(campaign, role_families, versions));
    set_selected_candidate_ids([]);
    setBulkInviteFeedback([]);
  }

  function setBulkInviteFeedback(lines: string[]) {
    set_invite_feedback(lines.filter(Boolean));
  }

  function upsert_campaign(next_campaign: CampaignDto) {
    set_campaigns((current) => {
      const existing = current.some((campaign) => campaign.id === next_campaign.id);
      return existing ? current.map((campaign) => (campaign.id === next_campaign.id ? next_campaign : campaign)) : [next_campaign, ...current];
    });
    set_selected_campaign_id(next_campaign.id);
  }

  function save_campaign() {
    start_transition(async () => {
      const response = await fetch(selected_campaign_id ? `/api/admin/campaigns/${selected_campaign_id}` : "/api/admin/campaigns", {
        body: JSON.stringify({
          assessment_version_id: form.assessment_version_id,
          deadline: form.deadline || null,
          invite_template: form.invite_template,
          name: form.name,
          purpose: form.purpose,
          reminder_template: form.reminder_template,
          role_family_id: form.role_family_id,
          settings: {
            reminder_schedule: {
              day_interval: form.reminder_day_interval,
              enabled: form.reminder_enabled,
            },
          },
          status: form.status,
        }),
        headers: { "Content-Type": "application/json" },
        method: selected_campaign_id ? "PATCH" : "POST",
      });
      const payload = (await response.json()) as { campaign?: CampaignDto; message?: string };

      if (!response.ok || !payload.campaign) {
        set_message(payload.message ?? "Unable to save the campaign.");
        return;
      }

      upsert_campaign(payload.campaign);
      set_form(build_form_state(payload.campaign, role_families, versions));
      set_message(payload.message ?? "Campaign saved.");
    });
  }

  function create_empty_campaign() {
    set_selected_campaign_id("");
    set_form(build_form_state(null, role_families, versions));
    set_message("");
    set_selected_candidate_ids([]);
    setBulkInviteFeedback([]);
  }

  function add_invites() {
    if (!selected_campaign) {
      set_message("Create or select a campaign before inviting candidates.");
      return;
    }

    start_transition(async () => {
      const response = await fetch(`/api/admin/campaigns/${selected_campaign.id}/invites`, {
        body: JSON.stringify({
          candidate_ids: selected_candidate_ids,
          emails: parse_campaign_emails(bulk_email_content),
          expires_in_days: 14,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        created_invites?: string[];
        errors?: string[];
        message?: string;
        skipped?: string[];
      };

      if (!response.ok) {
        set_message(payload.message ?? "Unable to create invites.");
        return;
      }

      const refreshed = await fetch("/api/admin/campaigns");
      const refreshed_payload = (await refreshed.json()) as { campaigns?: CampaignDto[] };
      if (refreshed.ok && refreshed_payload.campaigns) {
        set_campaigns(refreshed_payload.campaigns);
      }

      set_message(payload.message ?? "Invites created.");
      setBulkInviteFeedback([
        ...(payload.created_invites?.map((email) => `Created: ${email}`) ?? []),
        ...(payload.skipped?.map((email) => `Skipped duplicate: ${email}`) ?? []),
        ...(payload.errors?.map((entry) => `Error: ${entry}`) ?? []),
      ]);
      set_selected_candidate_ids([]);
      set_bulk_email_content("");
    });
  }

  function send_reminders(campaign_id: string) {
    start_transition(async () => {
      const response = await fetch(`/api/admin/campaigns/${campaign_id}/reminders`, {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string };
      set_message(payload.message ?? "Reminder state updated.");

      const refreshed = await fetch("/api/admin/campaigns");
      const refreshed_payload = (await refreshed.json()) as { campaigns?: CampaignDto[] };
      if (refreshed.ok && refreshed_payload.campaigns) {
        set_campaigns(refreshed_payload.campaigns);
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Badge tone="red">Campaigns</Badge>
            <CardTitle className="mt-3">Create & Edit Campaign</CardTitle>
            <CardDescription>Set up a test campaign, choose which role and assessment version to use, and configure automatic reminders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-black/60">Campaign name</span>
              <input
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Q2 2026 Plant Manager Batch"
                value={form.name}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, assessment_version_id: event.target.value }))}
                value={form.assessment_version_id}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version_label}
                  </option>
                ))}
              </select>
              <select
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, role_family_id: event.target.value }))}
                value={form.role_family_id}
              >
                {role_families.map((role_family) => (
                  <option key={role_family.id} value={role_family.id}>
                    {role_family.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, status: event.target.value as CampaignStatus }))}
                value={form.status}
              >
                {["DRAFT", "ACTIVE", "CLOSED"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, purpose: event.target.value as CampaignForm["purpose"] }))}
                value={form.purpose}
              >
                <option value="HIRING">Hiring</option>
                <option value="DEVELOPMENT">Development</option>
                <option value="SUCCESSION">Succession</option>
              </select>
              <input
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, deadline: event.target.value }))}
                type="datetime-local"
                value={form.deadline}
              />
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold">Invitation message</span>
              <p className="text-xs text-brand-black/50">This message will be included when candidates are invited to take the assessment.</p>
              <textarea
                className="min-h-24 w-full rounded-[1.3rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm leading-6 outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, invite_template: event.target.value }))}
                value={form.invite_template}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold">Reminder message</span>
              <p className="text-xs text-brand-black/50">Sent to candidates who have not yet completed the assessment.</p>
              <textarea
                className="min-h-24 w-full rounded-[1.3rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm leading-6 outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, reminder_template: event.target.value }))}
                value={form.reminder_template}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-[1.2rem] bg-brand-grey px-4 py-3">
                <input
                  checked={form.reminder_enabled}
                  onChange={(event) => set_form((current) => ({ ...current, reminder_enabled: event.target.checked }))}
                  type="checkbox"
                />
                <span className="text-sm font-semibold">Scheduled reminders enabled</span>
              </label>
              <input
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none focus:border-brand-red"
                min={1}
                onChange={(event) => set_form((current) => ({ ...current, reminder_day_interval: Number(event.target.value) }))}
                type="number"
                value={form.reminder_day_interval}
              />
            </div>

            {message ? <p className="text-sm text-brand-red">{message}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button disabled={is_pending} onClick={save_campaign} type="button">
                {selected_campaign_id ? "Save campaign" : "Create campaign"}
              </Button>
              <Button onClick={create_empty_campaign} type="button" variant="outline">
                New campaign
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add candidates</CardTitle>
            <CardDescription>Select existing users or paste email addresses to invite candidates to this campaign.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 space-y-2 overflow-auto rounded-[1.4rem] bg-brand-grey p-4">
              {candidates.map((candidate) => (
                <label className="flex items-center justify-between gap-3 rounded-[1rem] bg-brand-white px-3 py-3" key={candidate.id}>
                  <div>
                    <p className="text-sm font-semibold">{candidate.name}</p>
                    <p className="text-xs text-brand-black/65">{candidate.email}</p>
                  </div>
                  <input
                    checked={selected_candidate_ids.includes(candidate.id)}
                    onChange={(event) =>
                      set_selected_candidate_ids((current) =>
                        event.target.checked ? [...current, candidate.id] : current.filter((entry) => entry !== candidate.id),
                      )
                    }
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
            <textarea
              className="min-h-28 w-full rounded-[1.3rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm leading-6 outline-none focus:border-brand-red"
              onChange={(event) => set_bulk_email_content(event.target.value)}
              placeholder="Paste candidate emails, separated by commas, spaces, or new lines"
              value={bulk_email_content}
            />
            <Button disabled={is_pending || !selected_campaign} onClick={add_invites} type="button">
              Add invites
            </Button>
            {invite_feedback.length ? (
              <div className="rounded-[1.4rem] border border-brand-red/20 bg-brand-red/8 p-4 text-sm leading-6 text-brand-black/80">
                {invite_feedback.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>All campaigns</CardTitle>
            <CardDescription>Track how many candidates have been invited, started, and completed each campaign.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                className={`rounded-[1.5rem] border px-4 py-4 transition ${
                  campaign.id === selected_campaign?.id ? "border-brand-red bg-brand-red/8" : "border-brand-black/10 bg-brand-grey"
                }`}
                key={campaign.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{campaign.name}</p>
                    <p className="text-sm text-brand-black/70">
                      {campaign.role_family_name} | {campaign.assessment_version_label}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={campaign.status === "ACTIVE" ? "success" : campaign.status === "DRAFT" ? "red" : "neutral"}>{campaign.status}</Badge>
                    <Button onClick={() => select_campaign(campaign)} type="button" variant="outline">
                      Open
                    </Button>
                    <Button disabled={is_pending} onClick={() => send_reminders(campaign.id)} type="button" variant="secondary">
                      Remind pending
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  {[
                    { label: "Total", value: campaign.metrics.total },
                    { label: "Pending", value: campaign.metrics.pending },
                    { label: "In progress", value: campaign.metrics.in_progress },
                    { label: "Completed", value: campaign.metrics.completed },
                  ].map((metric) => (
                    <div className="rounded-[1rem] bg-brand-white px-3 py-3 text-sm" key={`${campaign.id}-${metric.label}`}>
                      <p className="text-brand-black/60">{metric.label}</p>
                      <p className="mt-1 text-xl font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-brand-black/65">
                  Deadline: {campaign.deadline ? format_date(campaign.deadline) : "No deadline"} | Next scheduled reminder:{" "}
                  {campaign.settings.reminder_schedule?.next_run_at ? format_date(campaign.settings.reminder_schedule.next_run_at) : "Not scheduled"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {selected_campaign ? (
          <Card>
            <CardHeader>
              <CardTitle>Candidate progress</CardTitle>
              <CardDescription>Track each candidate's status for {selected_campaign.name}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selected_campaign.invites.length ? (
                selected_campaign.invites.map((invite) => (
                  <div className="rounded-[1.4rem] bg-brand-grey p-4" key={invite.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{invite.candidate_name ?? invite.email}</p>
                        <p className="max-w-[18rem] overflow-x-auto whitespace-nowrap text-sm text-brand-black/68">{invite.email}</p>
                      </div>
                      <Badge tone={invite.status === "COMPLETED" ? "success" : invite.status === "SENT" ? "red" : "neutral"}>{invite.status}</Badge>
                    </div>
                    <div className="mt-2 space-y-2 text-sm text-brand-black/70">
                      <p>Invited: {invite.invited_at ? format_date(invite.invited_at) : "Not sent"} | Reminders: {invite.reminder_count}</p>
                      <p className="overflow-x-auto whitespace-nowrap font-semibold text-brand-black/82">Token: {invite.invite_token}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-brand-black/70">No invites created for this campaign yet.</p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function build_form_state(
  campaign: CampaignDto | null,
  role_families: RoleFamilyOption[],
  versions: AssessmentVersionDto[],
): CampaignForm {
  return {
    assessment_version_id: campaign?.assessment_version_id ?? versions[0]?.id ?? "",
    deadline: campaign?.deadline ? to_datetime_local(campaign.deadline) : "",
    invite_template:
      campaign?.invite_template ?? "You are invited to complete an assessment for D&H Secheron. Please use the link provided to begin.",
    name: campaign?.name ?? "",
    purpose: (campaign as Record<string, unknown>)?.purpose as CampaignForm["purpose"] ?? "HIRING",
    reminder_day_interval: campaign?.settings.reminder_schedule?.day_interval ?? 2,
    reminder_enabled: campaign?.settings.reminder_schedule?.enabled ?? false,
    reminder_template: campaign?.reminder_template ?? "Reminder: your assessment is still pending. Please complete it at your earliest convenience.",
    role_family_id: campaign?.role_family_id ?? role_families[0]?.id ?? "",
    status: campaign?.status ?? "DRAFT",
  };
}

function to_datetime_local(value: string) {
  const date = new Date(value);
  const offset_minutes = date.getTimezoneOffset();
  const local_date = new Date(date.getTime() - offset_minutes * 60 * 1000);
  return local_date.toISOString().slice(0, 16);
}
