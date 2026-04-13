"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CandidateAssessmentSummary, GovernanceRequestSummary } from "@/lib/ui-types";

export function CandidateHome({
  assessments,
  initial_requests,
}: {
  assessments: CandidateAssessmentSummary[];
  initial_requests: GovernanceRequestSummary[];
}) {
  const [requests, set_requests] = useState(initial_requests);
  const [message, set_message] = useState<string | null>(null);

  async function submit_request(form: HTMLFormElement) {
    const form_data = new FormData(form);
    const response = await fetch("/api/self/governance-requests", {
      body: JSON.stringify({
        assessment_id: String(form_data.get("assessment_id") || "") || undefined,
        request_note: String(form_data.get("request_note")),
        request_type: String(form_data.get("request_type")),
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json();
    set_message(payload.message ?? null);

    if (response.ok) {
      const refreshed = await fetch("/api/self/governance-requests", { credentials: "include" });
      const refreshed_payload = await refreshed.json();
      set_requests(refreshed_payload.requests);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">My account</Badge>
        <h1 className="text-4xl font-semibold">My Assessments</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          View your assessment feedback reports and manage your data privacy requests from here.
        </p>
        {message ? <p className="text-sm font-semibold text-brand-red">{message}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Your feedback reports</CardTitle>
            <CardDescription>Download your personalised assessment feedback once results are ready.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assessments.length ? (
              assessments.map((assessment) => (
                <div key={assessment.id} className="rounded-2xl border border-brand-black/10 px-4 py-4">
                  <p className="font-semibold text-brand-black">{assessment.role_family_name}</p>
                  <p className="text-sm text-brand-black/70">{format_status(assessment.status)}</p>
                  <div className="mt-3">
                    <a
                      className="inline-flex rounded-full border border-brand-red px-4 py-2 text-sm font-semibold text-brand-red"
                      href={`/api/reports/candidate-feedback/${assessment.id}/pdf`}
                      target="_blank"
                    >
                      Download candidate feedback
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-brand-black/70">Your feedback will appear here once your assessment has been scored and reviewed.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data & privacy requests</CardTitle>
            <CardDescription>Request a copy of your data, dispute a result, or ask for your data to be deleted.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submit_request(event.currentTarget);
              }}
            >
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-black/60">What would you like to do?</span>
                <select className="w-full rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="request_type">
                  {[
                    { label: "Request a copy of my data", value: "ACCESS" },
                    { label: "Dispute a result", value: "CHALLENGE" },
                    { label: "Request data deletion", value: "DELETE" },
                    { label: "Adverse action notice", value: "ADVERSE_ACTION_NOTICE" },
                  ].map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-black/60">Related assessment (optional)</span>
                <select className="w-full rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="assessment_id">
                  <option value="">Not specific to one assessment</option>
                  {assessments.map((assessment) => (
                    <option key={assessment.id} value={assessment.id}>
                      {assessment.role_family_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-black/60">Details</span>
                <textarea className="min-h-28 w-full rounded-[1.5rem] border border-brand-black/15 px-4 py-3 text-sm" name="request_note" placeholder="Please describe your request in detail..." />
              </label>
              <Button type="submit">Submit request</Button>
            </form>

            {requests.length > 0 ? (
              <div className="mt-6 space-y-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-black/60">Your previous requests</p>
                {requests.map((request) => (
                  <div key={request.id} className="rounded-2xl bg-brand-grey px-4 py-3">
                    <p className="font-semibold text-brand-black">
                      {format_request_type(request.request_type)} · {format_status(request.status)}
                    </p>
                    <p className="text-brand-black/70">{request.request_note}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  ACCESS: "Data access request",
  ADVERSE_ACTION_NOTICE: "Adverse action notice",
  CHALLENGE: "Result dispute",
  DELETE: "Deletion request",
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Results ready",
  IN_PROGRESS: "In progress",
  NOT_STARTED: "Not started",
  OPEN: "Open",
  PENDING: "Pending review",
  RESOLVED: "Resolved",
  SCORED: "Scored",
  STARTED: "In progress",
};

function format_request_type(type: string) {
  return REQUEST_TYPE_LABELS[type] ?? type.replaceAll("_", " ").toLowerCase();
}

function format_status(status: string) {
  return STATUS_LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ");
}
