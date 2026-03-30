"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComplianceSnapshot } from "@/lib/ui-types";

export function ComplianceManager({ initial_snapshot }: { initial_snapshot: ComplianceSnapshot }) {
  const [snapshot, set_snapshot] = useState(initial_snapshot);
  const [message, set_message] = useState<string | null>(null);

  async function save_settings(form: HTMLFormElement) {
    const form_data = new FormData(form);
    const response = await fetch("/api/admin/compliance", {
      body: JSON.stringify({
        candidate_feedback_enabled: form_data.get("candidate_feedback_enabled") === "true",
        challenge_process_enabled: form_data.get("challenge_process_enabled") === "true",
        data_fiduciary_registration_required: form_data.get("data_fiduciary_registration_required") === "true",
        retention_raw_responses_months: Number(form_data.get("retention_raw_responses_months")),
        retention_scores_years: Number(form_data.get("retention_scores_years")),
        self_service_access_enabled: form_data.get("self_service_access_enabled") === "true",
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
    const payload = await response.json();
    set_message(payload.message ?? null);
    if (response.ok && payload.snapshot) {
      set_snapshot(payload.snapshot);
    }
  }

  async function review_request(request_id: string, status: string) {
    const response = await fetch(`/api/admin/compliance/requests/${request_id}`, {
      body: JSON.stringify({
        resolution_note: status === "APPROVED" ? "Approved by HR admin." : "Returned for review.",
        status,
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json();
    set_message(payload.message ?? null);
    if (response.ok && payload.snapshot) {
      set_snapshot(payload.snapshot);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">Implemented in Step 5</Badge>
        <h1 className="text-4xl font-semibold">Compliance and Audit</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          DPDP controls, retention settings, consent visibility, access/challenge/delete workflows, and adverse-action notices are all
          managed here.
        </p>
        {message ? <p className="text-sm font-semibold text-brand-red">{message}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Compliance settings</CardTitle>
            <CardDescription>Retention, self-service access, and candidate feedback controls.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void save_settings(event.currentTarget);
              }}
            >
              {Object.entries(snapshot.settings).map(([key, value]) => (
                <label key={key} className="space-y-2 text-sm font-semibold text-brand-black">
                  {key.replaceAll("_", " ")}
                  {typeof value === "boolean" ? (
                    <select className="w-full rounded-full border border-brand-black/15 px-4 py-3 text-sm font-normal" defaultValue={String(value)} name={key}>
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : (
                    <input className="w-full rounded-full border border-brand-black/15 px-4 py-3 text-sm font-normal" defaultValue={String(value)} name={key} type="number" />
                  )}
                </label>
              ))}
              <div className="md:col-span-2">
                <Button type="submit">Save compliance settings</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consent and notices</CardTitle>
            <CardDescription>Template, record counts, and high-stakes adverse-action readiness.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-2xl bg-brand-grey px-4 py-4">
              <p className="font-semibold text-brand-black">Consent records</p>
              <p className="text-brand-black/70">{snapshot.consent_record_count} signed records stored</p>
            </div>
            <div className="rounded-2xl border border-brand-black/10 px-4 py-4">
              <p className="font-semibold text-brand-black">DPDP consent template</p>
              <p className="mt-2 whitespace-pre-wrap text-brand-black/70">{snapshot.consent_template}</p>
            </div>
            <div className="space-y-2">
              {snapshot.adverse_action_notices.map((notice) => (
                <div key={notice.assessment_id} className="rounded-2xl border border-brand-red/15 px-4 py-3">
                  <p className="font-semibold text-brand-black">{notice.candidate_name}</p>
                  <p className="text-brand-black/70">
                    Recommendation {notice.recommendation ?? "n/a"} · {notice.status}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Governance requests</CardTitle>
            <CardDescription>Access, challenge, deletion, and adverse-action workflows with tracked status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.requests.map((request) => (
              <div key={request.request_id} className="rounded-2xl border border-brand-black/10 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-black">
                      {request.user_name} · {request.request_type}
                    </p>
                    <p className="text-sm text-brand-black/70">{request.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => void review_request(request.request_id, "APPROVED")} type="button">
                      Approve
                    </Button>
                    <Button onClick={() => void review_request(request.request_id, "IN_REVIEW")} type="button" variant="outline">
                      Review
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-sm text-brand-black/70">{request.request_note}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
            <CardDescription>Recent sensitive score/report access for DPDP and governance review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {snapshot.audit_logs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className="rounded-2xl bg-brand-grey px-4 py-3">
                <p className="font-semibold text-brand-black">
                  {log.user_name} · {log.action}
                </p>
                <p className="text-brand-black/70">
                  {log.target_entity} · {log.timestamp} · {log.ip_address ?? "IP unavailable"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
