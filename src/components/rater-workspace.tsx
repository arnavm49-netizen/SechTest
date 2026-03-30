"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RaterWorkspaceSnapshot } from "@/lib/ui-types";

export function RaterWorkspace({ initial_workspace }: { initial_workspace: RaterWorkspaceSnapshot }) {
  const [workspace, set_workspace] = useState(initial_workspace);
  const [selected_assignment_id, set_selected_assignment_id] = useState(initial_workspace.assignments[0]?.assignment_id ?? "");
  const [message, set_message] = useState<string | null>(null);

  async function submit_responses(form: HTMLFormElement) {
    const form_data = new FormData(form);
    const responses = workspace.rater_items.map((item) => ({
      item_id: item.id,
      response_time_seconds: 12,
      response_value: Number(form_data.get(item.id)),
    }));
    const response = await fetch("/api/rater/respond", {
      body: JSON.stringify({
        assignment_id: selected_assignment_id,
        mark_completed: true,
        responses,
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json();
    set_message(payload.message ?? "Rater submission saved.");

    if (response.ok) {
      const refreshed = await fetch("/api/rater/assignments", { credentials: "include" });
      const refreshed_payload = await refreshed.json();
      set_workspace(refreshed_payload.workspace);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">Implemented in Step 5</Badge>
        <h1 className="text-4xl font-semibold">Rater home</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Raters complete only their assigned 360 items. Calibration status is enforced before any peer, report, or manager ratings can be
          submitted.
        </p>
        {message ? <p className="text-sm font-semibold text-brand-red">{message}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>Select one assignment and submit ratings across the full item set.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspace.assignments.map((assignment) => (
              <button
                key={assignment.assignment_id}
                className={`w-full rounded-[1.5rem] border px-4 py-4 text-left ${
                  selected_assignment_id === assignment.assignment_id
                    ? "border-brand-red bg-brand-red/6"
                    : "border-brand-black/10 bg-brand-grey"
                }`}
                onClick={() => set_selected_assignment_id(assignment.assignment_id)}
                type="button"
              >
                <p className="font-semibold text-brand-black">{assignment.subject_name}</p>
                <p className="text-sm text-brand-black/70">
                  {assignment.role_family_name} · {assignment.status} · Calibration {assignment.calibration_completed ? "complete" : "pending"}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submit ratings</CardTitle>
            <CardDescription>Likert 1-5 rating block with an estimated completion time of 15-20 minutes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit_responses(event.currentTarget);
              }}
            >
              {workspace.rater_items.map((item) => (
                <label key={item.id} className="block rounded-2xl border border-brand-black/10 px-4 py-4 text-sm">
                  <p className="font-semibold text-brand-black">{item.sub_dimension_name}</p>
                  <p className="mt-1 text-brand-black/70">{item.stem}</p>
                  <select className="mt-3 w-full rounded-full border border-brand-black/15 px-4 py-3" defaultValue="4" name={item.id}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <Button type="submit">Submit 360 ratings</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
