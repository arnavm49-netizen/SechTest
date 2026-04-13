"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RoleFamilyManagerSnapshot } from "@/lib/role-families";

type FormState = {
  description: string;
  id?: string;
  is_active: boolean;
  name: string;
  weight_matrix: Record<string, number>;
};

export function RoleFamilyManager({ initial_snapshot }: { initial_snapshot: RoleFamilyManagerSnapshot }) {
  const [snapshot, set_snapshot] = useState(initial_snapshot);
  const [message, set_message] = useState<string | null>(null);
  const [selected_role_family_id, set_selected_role_family_id] = useState(initial_snapshot.role_families[0]?.id ?? "new");
  const [form, set_form] = useState<FormState>(() => build_form_state(initial_snapshot, initial_snapshot.role_families[0]?.id));

  useEffect(() => {
    set_form(build_form_state(snapshot, selected_role_family_id));
  }, [selected_role_family_id, snapshot]);

  async function save_role_family(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    set_message(null);

    const response = await fetch("/api/admin/role-families", {
      body: JSON.stringify(form),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as { message?: string; snapshot?: RoleFamilyManagerSnapshot };
    set_message(payload.message ?? null);

    if (response.ok && payload.snapshot) {
      set_snapshot(payload.snapshot);
      const selected_id = form.id ?? payload.snapshot.role_families.find((role_family) => role_family.name === form.name)?.id ?? "new";
      set_selected_role_family_id(selected_id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">Operational module</Badge>
        <h1 className="text-4xl font-semibold">Role Family Manager</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Maintain role families, keep the weighting model current, and see where each role family is already being used by assessments and
          campaigns.
        </p>
        {message ? <p className="text-sm font-semibold text-brand-red">{message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Role families" value={String(snapshot.summary.total_count)} />
        <MetricCard label="Active families" value={String(snapshot.summary.active_count)} />
        <MetricCard label="Live campaigns" value={String(snapshot.summary.active_live_campaigns)} />
        <MetricCard label="Avg. weight total" value={String(snapshot.summary.average_weight_total)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <Card>
          <CardHeader>
            <CardTitle>Current role families</CardTitle>
            <CardDescription>Select one to edit it, or start a new role family from scratch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              className={`w-full rounded-[1.5rem] border px-4 py-4 text-left ${
                selected_role_family_id === "new" ? "border-brand-red bg-brand-red/6" : "border-brand-black/10 bg-brand-grey"
              }`}
              onClick={() => set_selected_role_family_id("new")}
              type="button"
            >
              <p className="font-semibold text-brand-black">Create new role family</p>
              <p className="text-sm text-brand-black/70">Define a new profile, description, and weight model.</p>
            </button>

            {snapshot.role_families.map((role_family) => (
              <button
                key={role_family.id}
                className={`w-full rounded-[1.5rem] border px-4 py-4 text-left ${
                  selected_role_family_id === role_family.id ? "border-brand-red bg-brand-red/6" : "border-brand-black/10 bg-brand-grey"
                }`}
                onClick={() => set_selected_role_family_id(role_family.id)}
                type="button"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-black">{role_family.name}</p>
                    <p className="text-sm text-brand-black/70">
                      {role_family.assessment_count} assessments · {role_family.active_campaign_count} live campaigns
                    </p>
                  </div>
                  <Badge tone={role_family.is_active ? "success" : "neutral"}>{role_family.is_active ? "ACTIVE" : "INACTIVE"}</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{form.id ? "Edit role family" : "Create role family"}</CardTitle>
            <CardDescription>Weight the role family across the active assessment layers used throughout the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={save_role_family}>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
                  onChange={(event) => set_form((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Role family name"
                  value={form.name}
                />
                <select
                  className="rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
                  onChange={(event) => set_form((current) => ({ ...current, is_active: event.target.value === "true" }))}
                  value={String(form.is_active)}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              <textarea
                className="min-h-32 w-full rounded-[1.5rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe what success looks like for this role family."
                value={form.description}
              />

              <div className="grid gap-3 md:grid-cols-2">
                {snapshot.layers.map((layer) => (
                  <label key={layer.code} className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey px-4 py-4">
                    <span className="block text-sm font-semibold text-brand-black">{layer.name}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-brand-black/55">{layer.code}</span>
                    <input
                      className="mt-3 w-full rounded-[1rem] border border-brand-black/15 bg-brand-white px-4 py-3 text-sm outline-none transition focus:border-brand-red"
                      min={0}
                      onChange={(event) =>
                        set_form((current) => ({
                          ...current,
                          weight_matrix: {
                            ...current.weight_matrix,
                            [layer.code]: Number(event.target.value),
                          },
                        }))
                      }
                      type="number"
                      value={form.weight_matrix[layer.code] ?? 0}
                    />
                  </label>
                ))}
              </div>

              <div className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey px-4 py-4 text-sm text-brand-black/74">
                Current total weight: <span className="font-semibold text-brand-black">{sum_weight_matrix(form.weight_matrix)}</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit">{form.id ? "Save role family" : "Create role family"}</Button>
                {form.id ? (
                  <Button
                    onClick={() => {
                      set_selected_role_family_id("new");
                      set_message(null);
                    }}
                    type="button"
                    variant="outline"
                  >
                    Create another
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function build_form_state(snapshot: RoleFamilyManagerSnapshot, selected_role_family_id?: string): FormState {
  const selected_role_family = snapshot.role_families.find((role_family) => role_family.id === selected_role_family_id);
  const base_weight_matrix = Object.fromEntries(snapshot.layers.map((layer) => [layer.code, selected_role_family?.weight_matrix[layer.code] ?? 0]));

  if (!selected_role_family) {
    return {
      description: "",
      is_active: true,
      name: "",
      weight_matrix: base_weight_matrix,
    };
  }

  return {
    description: selected_role_family.description,
    id: selected_role_family.id,
    is_active: selected_role_family.is_active,
    name: selected_role_family.name,
    weight_matrix: base_weight_matrix,
  };
}

function sum_weight_matrix(weight_matrix: Record<string, number>) {
  return Number(Object.values(weight_matrix).reduce((total, value) => total + value, 0).toFixed(1));
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-brand-black/10 bg-brand-grey px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-black/60">{label}</p>
      <p className="mt-2 text-xl font-semibold text-brand-black">{value}</p>
    </div>
  );
}
