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
        <Badge tone="red">Self-service portal</Badge>
        <h1 className="text-4xl font-semibold">Assessment home</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Controlled feedback, access requests, challenge requests, and deletion requests are all available here without exposing raw score
          internals.
        </p>
        {message ? <p className="text-sm font-semibold text-brand-red">{message}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Your reports</CardTitle>
            <CardDescription>Candidate feedback stays simplified and RBAC-safe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assessments.length ? (
              assessments.map((assessment) => (
                <div key={assessment.id} className="rounded-2xl border border-brand-black/10 px-4 py-4">
                  <p className="font-semibold text-brand-black">{assessment.role_family_name}</p>
                  <p className="text-sm text-brand-black/70">{assessment.status}</p>
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
              <p className="text-brand-black/70">No completed assessment feedback is ready yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rights requests</CardTitle>
            <CardDescription>Request access, challenge a result, or request deletion under the configured governance policy.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submit_request(event.currentTarget);
              }}
            >
              <select className="w-full rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="request_type">
                {["ACCESS", "CHALLENGE", "DELETE", "ADVERSE_ACTION_NOTICE"].map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <select className="w-full rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="assessment_id">
                <option value="">No specific assessment</option>
                {assessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.role_family_name}
                  </option>
                ))}
              </select>
              <textarea className="min-h-28 w-full rounded-[1.5rem] border border-brand-black/15 px-4 py-3 text-sm" name="request_note" placeholder="Describe the request" />
              <Button type="submit">Submit request</Button>
            </form>

            <div className="mt-6 space-y-3 text-sm">
              {requests.map((request) => (
                <div key={request.id} className="rounded-2xl bg-brand-grey px-4 py-3">
                  <p className="font-semibold text-brand-black">
                    {request.request_type} · {request.status}
                  </p>
                  <p className="text-brand-black/70">{request.request_note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
