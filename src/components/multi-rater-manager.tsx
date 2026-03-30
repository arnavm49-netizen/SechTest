"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MultiRaterSnapshot } from "@/lib/ui-types";

export function MultiRaterManager({ initial_snapshot }: { initial_snapshot: MultiRaterSnapshot }) {
  const [snapshot, set_snapshot] = useState(initial_snapshot);
  const [message, set_message] = useState<string | null>(null);

  async function save_settings(form: HTMLFormElement) {
    const form_data = new FormData(form);
    const response = await fetch("/api/admin/multi-rater", {
      body: JSON.stringify({
        blind_spot_flag_threshold: Number(form_data.get("blind_spot_flag_threshold")),
        icc_threshold: Number(form_data.get("icc_threshold")),
        max_ratees_per_rater: Number(form_data.get("max_ratees_per_rater")),
        max_raters_per_subject: Number(form_data.get("max_raters_per_subject")),
        min_raters_per_subject: Number(form_data.get("min_raters_per_subject")),
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

  async function create_cycle(form: HTMLFormElement) {
    const form_data = new FormData(form);
    const subject_assessment = String(form_data.get("assessment_id"));
    const subject = snapshot.assessments.find((entry) => entry.assessment_id === subject_assessment);

    if (!subject) {
      set_message("Select an assessment to launch the 360 cycle.");
      return;
    }

    const assignments = [
      { rater_id: subject.subject_id, relationship: "SELF" },
      { rater_id: String(form_data.get("peer_rater_id")), relationship: "PEER" },
      { rater_id: String(form_data.get("direct_report_rater_id")), relationship: "DIRECT_REPORT" },
      { rater_id: String(form_data.get("manager_rater_id")), relationship: "MANAGER" },
    ];
    const response = await fetch("/api/admin/multi-rater", {
      body: JSON.stringify({
        assessment_id: subject.assessment_id,
        assignments,
        subject_id: subject.subject_id,
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json();
    set_message(payload.message ?? payload.error ?? null);
    if (response.ok && payload.snapshot) {
      set_snapshot(payload.snapshot);
    }
  }

  async function mark_calibrated(assignment_id: string, calibration_completed: boolean) {
    const response = await fetch("/api/admin/multi-rater/calibration", {
      body: JSON.stringify({ assignment_ids: [assignment_id], calibration_completed }),
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
        <h1 className="text-4xl font-semibold">360 Configuration</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Build subject-specific 360 cycles, enforce calibration before release, and monitor ICC reliability and blind-spot risk for
          leadership development.
        </p>
        {message ? <p className="text-sm font-semibold text-brand-red">{message}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>360 settings</CardTitle>
            <CardDescription>Admin-controlled subject/rater limits and calibration thresholds.</CardDescription>
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
                  <input
                    className="w-full rounded-full border border-brand-black/15 px-4 py-3 text-sm font-normal"
                    defaultValue={String(value)}
                    name={key}
                    type="number"
                  />
                </label>
              ))}
              <div className="md:col-span-2">
                <Button type="submit">Save 360 settings</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create a 360 cycle</CardTitle>
            <CardDescription>Launch only after a full self/peer/direct-report/manager set is defined.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void create_cycle(event.currentTarget);
              }}
            >
              <select className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="assessment_id">
                {snapshot.assessments.map((assessment) => (
                  <option key={assessment.assessment_id} value={assessment.assessment_id}>
                    {assessment.candidate_name} · {assessment.role_family_name}
                  </option>
                ))}
              </select>
              <select className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="peer_rater_id">
                {snapshot.raters.map((rater) => (
                  <option key={rater.id} value={rater.id}>
                    Peer · {rater.name}
                  </option>
                ))}
              </select>
              <select className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="direct_report_rater_id">
                {snapshot.raters.map((rater) => (
                  <option key={rater.id} value={rater.id}>
                    Direct report · {rater.name}
                  </option>
                ))}
              </select>
              <select className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="manager_rater_id">
                {snapshot.raters.map((rater) => (
                  <option key={rater.id} value={rater.id}>
                    Manager · {rater.name}
                  </option>
                ))}
              </select>
              <div className="md:col-span-2">
                <Button type="submit" variant="secondary">
                  Create 360 cycle
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Assignments and calibration</CardTitle>
            <CardDescription>Raters are blocked until calibration is marked complete.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.assignments.map((assignment) => (
              <div key={assignment.assignment_id} className="rounded-2xl border border-brand-black/10 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-black">
                      {assignment.subject_name} · {assignment.relationship}
                    </p>
                    <p className="text-sm text-brand-black/70">
                      Rater: {assignment.rater_name} · {assignment.role_family_name} · {assignment.status}
                    </p>
                  </div>
                  <Button
                    onClick={() => void mark_calibrated(assignment.assignment_id, !assignment.calibration_completed)}
                    type="button"
                    variant={assignment.calibration_completed ? "outline" : "primary"}
                  >
                    {assignment.calibration_completed ? "Mark pending" : "Mark calibrated"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ICC summary</CardTitle>
            <CardDescription>Relationship-level reliability guardrails for release readiness.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.icc_summary.map((entry) => (
              <div key={`${entry.subject_id}-${entry.relationship}`} className="rounded-2xl border border-brand-black/10 px-4 py-4">
                <p className="font-semibold text-brand-black">
                  {entry.subject_name} · {entry.relationship}
                </p>
                <p className="text-sm text-brand-black/70">
                  ICC: {entry.icc ?? "n/a"} · Items: {entry.sample_n} · {entry.status}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
