"use client";

import { useState } from "react";
import { NineBoxGrid } from "@/components/nine-box-grid";
import { HeatmapGrid, RadarChart } from "@/components/report-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IndividualReportView, TeamHeatmapView } from "@/lib/ui-types";

export function TeamWorkspace({
  initial_heatmap,
  initial_reports,
}: {
  initial_heatmap: TeamHeatmapView;
  initial_reports: IndividualReportView[];
}) {
  const [selected_report, set_selected_report] = useState<IndividualReportView | null>(initial_reports[0] ?? null);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">Manager view</Badge>
        <h1 className="text-4xl font-semibold">My Team</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          See how your direct reports match their roles, where they excel, and where they may need development support. Individual test
          responses stay private.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Completed assessments" value={String(initial_heatmap.summary.assessment_count)} />
        <MetricCard label="Needs attention" value={String(initial_heatmap.summary.high_risk_cells)} />
        <MetricCard label="Strong matches" value={String(initial_heatmap.summary.strong_fit_count)} />
        <MetricCard label="Export" value="Excel ready" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team strengths overview</CardTitle>
          <CardDescription>Colour-coded view showing where your team is strong and where there may be gaps across different skill areas.</CardDescription>
        </CardHeader>
        <CardContent>
          <HeatmapGrid rows={initial_heatmap.rows} sub_dimensions={initial_heatmap.sub_dimensions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>9-Box Talent Grid</CardTitle>
          <CardDescription>Performance (cognitive + execution + judgment) vs Potential (personality + leadership + motivators). Click a cell to filter the team list below.</CardDescription>
        </CardHeader>
        <CardContent>
          <NineBoxGrid
            entries={initial_reports.map((r) => ({
              candidate_name: r.assessment.candidate_name,
              performance_pct: r.fit.performance_pct ?? r.fit.fit_score_pct ?? 50,
              potential_pct: r.fit.potential_pct ?? r.fit.fit_score_pct ?? 50,
              role_family: r.assessment.role_family_name,
              nine_box: r.fit.nine_box ?? "MODERATE_PERFORMANCE_MODERATE_POTENTIAL",
              fit_score_pct: r.fit.fit_score_pct ?? 0,
            }))}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Team member results</CardTitle>
            <CardDescription>Select a team member to see their role suitability and development areas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {initial_reports.map((report) => (
              <button
                key={report.assessment.assessment_id}
                className={`w-full rounded-[1.5rem] border px-4 py-4 text-left ${
                  selected_report?.assessment.assessment_id === report.assessment.assessment_id
                    ? "border-brand-red bg-brand-red/6"
                    : "border-brand-black/10 bg-brand-grey"
                }`}
                onClick={() => set_selected_report(report)}
                type="button"
              >
                <p className="font-semibold text-brand-black">{report.assessment.candidate_name}</p>
                <p className="text-sm text-brand-black/70">
                  {report.assessment.role_family_name} · {report.fit.recommendation ?? "Pending"} · {report.fit.fit_score_pct ?? "n/a"}%
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        {selected_report ? (
          <Card>
            <CardHeader>
              <CardTitle>{selected_report.assessment.candidate_name}</CardTitle>
              <CardDescription>Score summary and development priorities.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadarChart
                metrics={selected_report.layer_scores.map((score) => ({
                  label: score.label,
                  score_0_100: score.score_0_100,
                }))}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-brand-black/8">
                  <CardHeader>
                    <CardTitle>Key strengths</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selected_report.fit.top_drivers.map((driver) => (
                      <p key={driver.label}>
                        <span className="font-semibold">{driver.label}</span>: {driver.weighted_contribution ?? "n/a"}
                      </p>
                    ))}
                  </CardContent>
                </Card>
                <Card className="border-brand-black/8">
                  <CardHeader>
                    <CardTitle>Development priorities</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selected_report.development_plan.slice(0, 4).map((gap) => (
                      <p key={gap.sub_dimension_name}>
                        <span className="font-semibold">{gap.sub_dimension_name}</span>: {gap.score_0_100 ?? "n/a"}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              </div>
              <GeneratePlanButton assessment_id={selected_report.assessment.assessment_id} candidate_name={selected_report.assessment.candidate_name} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function GeneratePlanButton({ assessment_id, candidate_name }: { assessment_id: string; candidate_name: string }) {
  const [status, set_status] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [plan_summary, set_plan_summary] = useState<string | null>(null);

  async function generate() {
    set_status("loading");
    try {
      const r = await fetch("/api/admin/development/generate-plan", {
        body: JSON.stringify({ assessment_id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        credentials: "include",
      });
      const p = await r.json();
      if (r.ok && p.plan) {
        set_status("done");
        set_plan_summary(p.plan.plan_summary ?? "Plan generated successfully.");
      } else {
        set_status("error");
        set_plan_summary(p.message ?? "Unable to generate plan.");
      }
    } catch {
      set_status("error");
      set_plan_summary("Network error.");
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <Button disabled={status === "loading"} onClick={generate} variant={status === "done" ? "outline" : "primary"}>
        {status === "loading" ? "Generating..." : status === "done" ? "Regenerate plan" : `Generate development plan for ${candidate_name.split(" ")[0]}`}
      </Button>
      {plan_summary ? (
        <div className="rounded-xl bg-brand-grey p-4 text-[13px] leading-relaxed text-brand-black/65 whitespace-pre-line">
          {plan_summary}
        </div>
      ) : null}
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
