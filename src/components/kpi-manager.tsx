"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { KpiSnapshot, SimpleDirectoryEntry } from "@/lib/ui-types";

export function KpiManager({
  initial_snapshot,
  role_families,
  users,
}: {
  initial_snapshot: KpiSnapshot;
  role_families: SimpleDirectoryEntry[];
  users: SimpleDirectoryEntry[];
}) {
  const [snapshot, set_snapshot] = useState(initial_snapshot);
  const [message, set_message] = useState<string | null>(null);

  async function create_definition(form: HTMLFormElement) {
    const form_data = new FormData(form);
    const response = await fetch("/api/admin/kpis", {
      body: JSON.stringify({
        data_source: String(form_data.get("data_source")),
        kpi_description: String(form_data.get("kpi_description")),
        kpi_name: String(form_data.get("kpi_name")),
        measurement_frequency: String(form_data.get("measurement_frequency")),
        measurement_unit: String(form_data.get("measurement_unit")),
        prediction_horizon_months: Number(form_data.get("prediction_horizon_months")),
        role_family_id: String(form_data.get("role_family_id")),
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

  async function create_observation(form: HTMLFormElement) {
    const form_data = new FormData(form);
    const now = new Date();
    const response = await fetch("/api/admin/kpis/observations", {
      body: JSON.stringify({
        kpi_definition_id: String(form_data.get("kpi_definition_id")),
        observation_date: now.toISOString(),
        period_end: now.toISOString(),
        period_start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        user_id: String(form_data.get("user_id")),
        value: Number(form_data.get("value")),
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
        <Badge tone="red">Implemented in Step 6</Badge>
        <h1 className="text-4xl font-semibold">KPI Management and Outcome Linkage</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Define role-family KPIs, capture observations, inspect prediction horizons, and review board-facing EBITDA sensitivity from linked
          outcomes.
        </p>
        {message ? <p className="text-sm font-semibold text-brand-red">{message}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create KPI definition</CardTitle>
            <CardDescription>Every role family can carry its own KPI architecture and prediction horizon.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void create_definition(event.currentTarget);
              }}
            >
              <input className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="kpi_name" placeholder="KPI name" />
              <input className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="measurement_unit" placeholder="Unit" />
              <select className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="measurement_frequency">
                {["MONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL"].map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {frequency}
                  </option>
                ))}
              </select>
              <input
                className="rounded-full border border-brand-black/15 px-4 py-3 text-sm"
                defaultValue="6"
                name="prediction_horizon_months"
                type="number"
              />
              <select className="rounded-full border border-brand-black/15 px-4 py-3 text-sm md:col-span-2" name="role_family_id">
                {role_families.map((role_family) => (
                  <option key={role_family.id} value={role_family.id}>
                    {role_family.name}
                  </option>
                ))}
              </select>
              <input className="rounded-full border border-brand-black/15 px-4 py-3 text-sm md:col-span-2" name="data_source" placeholder="Data source" />
              <textarea className="min-h-28 rounded-[1.5rem] border border-brand-black/15 px-4 py-3 text-sm md:col-span-2" name="kpi_description" placeholder="Description" />
              <div className="md:col-span-2">
                <Button type="submit">Create KPI</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Record KPI observation</CardTitle>
            <CardDescription>Observations automatically link to the latest completed assessment for that user and role family.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void create_observation(event.currentTarget);
              }}
            >
              <select className="rounded-full border border-brand-black/15 px-4 py-3 text-sm md:col-span-2" name="kpi_definition_id">
                {snapshot.definitions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.role_family_name} · {definition.kpi_name}
                  </option>
                ))}
              </select>
              <select className="rounded-full border border-brand-black/15 px-4 py-3 text-sm md:col-span-2" name="user_id">
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <input className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="value" placeholder="Observed value" type="number" />
              <div className="flex items-center">
                <Button type="submit" variant="secondary">
                  Save observation
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>KPI definitions and horizons</CardTitle>
          <CardDescription>Prediction checkpoints remain visible so outcomes are interpreted at the correct time horizon.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.definitions.map((definition) => (
            <div key={definition.id} className="rounded-2xl border border-brand-black/10 px-4 py-4">
              <p className="font-semibold text-brand-black">{definition.kpi_name}</p>
              <p className="text-sm text-brand-black/70">
                {definition.role_family_name} · {definition.measurement_frequency} · {definition.prediction_horizon_months} months
              </p>
              <p className="mt-2 text-sm text-brand-black/70">{definition.kpi_description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Correlation view</CardTitle>
            <CardDescription>Naive, manager-quality-adjusted, and within-manager comparisons per KPI and layer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {snapshot.correlations.map((entry) => (
              <div key={`${entry.role_family_name}-${entry.kpi_name}`} className="rounded-2xl border border-brand-black/10 px-4 py-4">
                <p className="font-semibold text-brand-black">
                  {entry.role_family_name} · {entry.kpi_name}
                </p>
                <p className="text-brand-black/70">
                  n={entry.sample_n} {entry.small_n_warning ? "· Preliminary" : ""}
                </p>
                <div className="mt-3 space-y-2">
                  {entry.summaries.map((summary) => (
                    <p key={summary.layer_code}>
                      <span className="font-semibold">{summary.layer_code}</span>: naive {summary.naive_correlation ?? "n/a"}, adjusted{" "}
                      {summary.adjusted_correlation ?? "n/a"}, within-manager {summary.within_manager_correlation ?? "n/a"}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>EBITDA attribution board view</CardTitle>
            <CardDescription>Top simulated trait levers once enough linked outcome data exists.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="font-semibold text-brand-black">{snapshot.board_summary.headline}</p>
            {snapshot.board_summary.sensitivities.map((entry) => (
              <div key={entry.trait_name} className="rounded-2xl bg-brand-grey px-4 py-4">
                <p className="font-semibold text-brand-black">{entry.trait_name}</p>
                <p className="text-brand-black/70">
                  Estimated EBITDA lift: {entry.estimated_ebitda_lift_pct ?? "n/a"}% · n={entry.sample_n}
                  {entry.small_n_warning ? " · Preliminary" : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
