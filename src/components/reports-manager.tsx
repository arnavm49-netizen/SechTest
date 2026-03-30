"use client";

import { useEffect, useState } from "react";
import { RadarChart, HeatmapGrid } from "@/components/report-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CandidateFeedbackView, IndividualReportView, ReportsSnapshot, TeamHeatmapView } from "@/lib/ui-types";

export function ReportsManager({ initial_snapshot }: { initial_snapshot: ReportsSnapshot }) {
  const [snapshot, set_snapshot] = useState(initial_snapshot);
  const [selected_assessment_id, set_selected_assessment_id] = useState(initial_snapshot.recent_assessments[0]?.assessment_id ?? "");
  const [selected_manager_id, set_selected_manager_id] = useState(initial_snapshot.managers[0]?.id ?? "all");
  const [individual_report, set_individual_report] = useState<IndividualReportView | null>(null);
  const [candidate_feedback, set_candidate_feedback] = useState<CandidateFeedbackView | null>(null);
  const [heatmap, set_heatmap] = useState<TeamHeatmapView | null>(null);
  const [message, set_message] = useState<string | null>(null);

  useEffect(() => {
    async function load_previews() {
      if (selected_assessment_id) {
        const [report_response, feedback_response] = await Promise.all([
          fetch(`/api/reports/individual/${selected_assessment_id}`, { credentials: "include" }),
          fetch(`/api/reports/candidate-feedback/${selected_assessment_id}`, { credentials: "include" }),
        ]);
        const report_payload = await report_response.json();
        const feedback_payload = await feedback_response.json();
        set_individual_report(report_payload.report ?? null);
        set_candidate_feedback(feedback_payload.report ?? null);
      } else {
        set_individual_report(null);
        set_candidate_feedback(null);
      }

      const active_manager_id = selected_manager_id !== "all" ? selected_manager_id : (snapshot.managers[0]?.id ?? "");

      if (active_manager_id) {
        const heatmap_response = await fetch(`/api/reports/team/${active_manager_id}`, { credentials: "include" });
        const heatmap_payload = await heatmap_response.json();
        set_heatmap(heatmap_payload.heatmap ?? null);
      } else {
        set_heatmap(null);
      }
    }

    void load_previews();
  }, [selected_assessment_id, selected_manager_id, snapshot.managers]);

  async function handle_template_save(template: ReportsSnapshot["templates"][number], form: HTMLFormElement) {
    const form_data = new FormData(form);
    const body = {
      branding: JSON.parse(String(form_data.get("branding") ?? "{}")),
      distribution_rules: JSON.parse(String(form_data.get("distribution_rules") ?? "{}")),
      sections_config: JSON.parse(String(form_data.get("sections_config") ?? "[]")),
      template_id: template.id,
    };
    const response = await fetch("/api/admin/reports", {
      body: JSON.stringify(body),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = await response.json();
    set_message(payload.message ?? "Template updated.");

    if (response.ok) {
      const refreshed = await fetch("/api/admin/reports", { credentials: "include" });
      const refreshed_payload = await refreshed.json();
      set_snapshot(refreshed_payload.snapshot);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">Implemented in Step 4</Badge>
        <h1 className="text-4xl font-semibold">Reports Configuration and Delivery</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          On-screen report previews, downloadable PDFs, team heatmaps, and template-level branding are now all managed here. Candidate
          feedback remains simplified and RBAC-safe.
        </p>
        {message ? <p className="text-sm font-semibold text-brand-red">{message}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent individual reports</CardTitle>
            <CardDescription>Select a completed assessment to preview the internal and candidate-facing report views.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {snapshot.recent_assessments.map((assessment) => (
                <button
                  key={assessment.assessment_id}
                  className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                    selected_assessment_id === assessment.assessment_id
                      ? "border-brand-red bg-brand-red/6"
                      : "border-brand-black/10 bg-brand-grey hover:border-brand-red/40"
                  }`}
                  onClick={() => set_selected_assessment_id(assessment.assessment_id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand-black">{assessment.candidate_name}</p>
                      <p className="text-sm text-brand-black/70">
                        {assessment.role_family_name} · {assessment.latest_recommendation ?? "Pending"} ·{" "}
                        {assessment.latest_fit_score_pct ?? "n/a"}%
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        className="inline-flex rounded-full border border-brand-black px-3 py-1 text-xs font-semibold"
                        href={`/api/reports/individual/${assessment.assessment_id}/pdf`}
                        target="_blank"
                      >
                        PDF
                      </a>
                      <a
                        className="inline-flex rounded-full border border-brand-red px-3 py-1 text-xs font-semibold text-brand-red"
                        href={`/api/reports/candidate-feedback/${assessment.assessment_id}/pdf`}
                        target="_blank"
                      >
                        Candidate PDF
                      </a>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team heatmap export</CardTitle>
            <CardDescription>Manager-safe grid view with Excel export and role-fit context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="w-full rounded-full border border-brand-black/15 bg-brand-white px-4 py-3 text-sm"
              onChange={(event) => set_selected_manager_id(event.target.value)}
              value={selected_manager_id}
            >
              {snapshot.managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
            {selected_manager_id !== "all" ? (
              <a
                className="inline-flex rounded-full border border-brand-black bg-brand-black px-4 py-2 text-sm font-semibold text-brand-white"
                href={`/api/reports/team/${selected_manager_id}/xlsx`}
                target="_blank"
              >
                Export team heatmap
              </a>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {individual_report ? (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle>Internal assessment report</CardTitle>
              <CardDescription>
                {individual_report.assessment.candidate_name} · {individual_report.assessment.role_family_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label="Fit score" value={`${individual_report.fit.fit_score_pct ?? "n/a"}%`} />
                <MetricCard label="Recommendation" value={individual_report.fit.recommendation ?? "Pending"} />
                <MetricCard label="Model" value={individual_report.report_model ?? "n/a"} />
              </div>
              <RadarChart
                metrics={individual_report.layer_scores.map((score) => ({
                  label: score.label,
                  score_0_100: score.score_0_100,
                }))}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-brand-black/8">
                  <CardHeader>
                    <CardTitle>Top drivers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {individual_report.fit.top_drivers.map((driver) => (
                      <p key={driver.label}>
                        <span className="font-semibold">{driver.label}</span>: {driver.weighted_contribution ?? "n/a"}
                      </p>
                    ))}
                  </CardContent>
                </Card>
                <Card className="border-brand-black/8">
                  <CardHeader>
                    <CardTitle>Top constraints</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {individual_report.fit.top_constraints.map((constraint) => (
                      <p key={constraint.label}>
                        <span className="font-semibold">{constraint.label}</span>: {constraint.gap_to_ideal ?? "n/a"}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-brand-black/8">
                  <CardHeader>
                    <CardTitle>Personality vector</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {individual_report.personality_vector.map((trait) => (
                      <div key={trait.sub_dimension_name}>
                        <div className="flex items-center justify-between">
                          <span>{trait.sub_dimension_name}</span>
                          <span className="font-semibold">{trait.score_0_10} / 10</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-brand-grey">
                          <div className="h-2 rounded-full bg-brand-red" style={{ width: `${trait.score_0_10 * 10}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="border-brand-black/8">
                  <CardHeader>
                    <CardTitle>Motivation archetype</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {individual_report.motivation_archetype.map((entry) => (
                      <div key={entry.archetype} className="rounded-2xl bg-brand-grey px-4 py-3">
                        <p className="font-semibold">{entry.archetype}</p>
                        <p className="text-brand-black/70">{entry.score_0_100} / 100</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
              <Card className="border-brand-black/8">
                <CardHeader>
                  <CardTitle>Development plan and behaviour mapping</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {individual_report.development_plan.map((gap) => (
                    <div key={gap.sub_dimension_name} className="rounded-2xl border border-brand-black/10 px-4 py-3">
                      <p className="font-semibold">
                        {gap.sub_dimension_name} {gap.high_stakes_gap ? "(high stakes)" : ""}
                      </p>
                      <p className="text-brand-black/70">Current score: {gap.score_0_100 ?? "n/a"}</p>
                      <p className="text-brand-black/70">
                        Recommendations: {gap.recommendation_texts.length ? gap.recommendation_texts.join(" | ") : "Library gap pending"}
                      </p>
                    </div>
                  ))}
                  {individual_report.behaviour_maps.slice(0, 4).map((entry) => (
                    <div key={entry.sub_dimension_name} className="rounded-2xl bg-brand-grey px-4 py-3">
                      <p className="font-semibold">{entry.sub_dimension_name}</p>
                      <p>{entry.behaviour_description}</p>
                      <p className="text-brand-black/70">{entry.outcome_description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Candidate feedback view</CardTitle>
                <CardDescription>Simplified strengths and development report with no raw scores exposed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {candidate_feedback ? (
                  <>
                    <MetricCard label="Feedback indicator" value={candidate_feedback.feedback_indicator} />
                    <div>
                      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand-black/60">Strength areas</p>
                      <div className="space-y-2">
                        {candidate_feedback.strengths.map((entry) => (
                          <div key={entry.label} className="rounded-2xl bg-brand-grey px-4 py-3 text-sm">
                            {entry.label}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand-black/60">Development areas</p>
                      <div className="space-y-2">
                        {candidate_feedback.development_areas.map((entry) => (
                          <div key={entry.sub_dimension_name} className="rounded-2xl border border-brand-black/10 px-4 py-3 text-sm">
                            {entry.sub_dimension_name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blind-spot analysis</CardTitle>
                <CardDescription>Leadership self vs peer-average gap when 360 data exists.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {individual_report?.blind_spot_gaps?.length ? (
                  individual_report.blind_spot_gaps.map((gap) => (
                    <div key={gap.sub_dimension_name} className="rounded-2xl border border-brand-black/10 px-4 py-3">
                      <p className="font-semibold">{gap.sub_dimension_name}</p>
                      <p className="text-brand-black/70">
                        Self {gap.self_score_100} vs peer {gap.peer_average_100} {gap.blind_spot_flag ? "· Blind spot" : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-brand-black/70">No completed 360 cycle is linked yet for this assessment.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {heatmap ? (
        <Card>
          <CardHeader>
            <CardTitle>Team composition heatmap</CardTitle>
            <CardDescription>
              {heatmap.summary.assessment_count} assessments · {heatmap.summary.high_risk_cells} high-risk cells
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HeatmapGrid rows={heatmap.rows} sub_dimensions={heatmap.sub_dimensions} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {snapshot.templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle>{template.name}</CardTitle>
              <CardDescription>{template.report_type}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handle_template_save(template, event.currentTarget);
                }}
              >
                <textarea
                  className="min-h-28 w-full rounded-[1.5rem] border border-brand-black/10 px-4 py-3 text-xs"
                  defaultValue={JSON.stringify(template.sections_config, null, 2)}
                  name="sections_config"
                />
                <textarea
                  className="min-h-28 w-full rounded-[1.5rem] border border-brand-black/10 px-4 py-3 text-xs"
                  defaultValue={JSON.stringify(template.branding, null, 2)}
                  name="branding"
                />
                <textarea
                  className="min-h-28 w-full rounded-[1.5rem] border border-brand-black/10 px-4 py-3 text-xs"
                  defaultValue={JSON.stringify(template.distribution_rules, null, 2)}
                  name="distribution_rules"
                />
                <Button type="submit" variant="secondary">
                  Save template
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-brand-black/10 bg-brand-grey px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-black/60">{label}</p>
      <p className="mt-2 text-xl font-semibold text-brand-black">{value}</p>
    </div>
  );
}
