"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScoringAdminSnapshot, ScoringModelDto } from "@/lib/scoring-admin-types";
import type { ScoringEngineMode, ScoringModelConfig } from "@/lib/scoring/types";

type ScoringModelForm = {
  config: ScoringModelConfig;
  default_ideal_ranges_json: string;
  engine_mode: ScoringEngineMode;
  id: string;
  name: string;
  notes: string;
  role_family_ideal_ranges_json: string;
  version_label: string;
};

const input_class_name =
  "w-full rounded-[1.1rem] border border-brand-black/12 bg-brand-grey px-4 py-3 text-sm text-brand-black outline-none transition focus:border-brand-red";

export function ScoringManager({ initial_snapshot }: { initial_snapshot: ScoringAdminSnapshot }) {
  const [snapshot, set_snapshot] = useState(initial_snapshot);
  const [selected_model_id, set_selected_model_id] = useState(initial_snapshot.models[0]?.id ?? "");
  const [selected_norm_group_id, set_selected_norm_group_id] = useState(initial_snapshot.norm_groups[0]?.id ?? "");
  const [selected_assessment_ids, set_selected_assessment_ids] = useState<string[]>([]);
  const [message, set_message] = useState("");
  const [new_norm_group_name, set_new_norm_group_name] = useState("Role-Calibrated Norm");
  const [new_norm_group_description, set_new_norm_group_description] = useState(
    "Norm cohort for recomputing sub-dimension means, standard deviations, and percentiles.",
  );
  const [model_form, set_model_form] = useState<ScoringModelForm | null>(build_model_form(initial_snapshot.models[0] ?? null));
  const [is_pending, start_transition] = useTransition();

  const selected_model = useMemo(
    () => snapshot.models.find((model) => model.id === selected_model_id) ?? snapshot.models[0] ?? null,
    [selected_model_id, snapshot.models],
  );

  async function refresh_snapshot(next_message?: string, preferred_model_id?: string, preferred_norm_group_id?: string) {
    const response = await fetch("/api/admin/scoring");
    const payload = (await response.json()) as { message?: string; snapshot?: ScoringAdminSnapshot };

    if (!response.ok || !payload.snapshot) {
      set_message(payload.message ?? "Unable to refresh the scoring workspace.");
      return;
    }

    const next_model_id =
      (preferred_model_id && payload.snapshot.models.some((model) => model.id === preferred_model_id)
        ? preferred_model_id
        : payload.snapshot.models.some((model) => model.id === selected_model_id)
          ? selected_model_id
          : payload.snapshot.models[0]?.id) ?? "";
    const next_norm_group_id =
      (preferred_norm_group_id && payload.snapshot.norm_groups.some((group) => group.id === preferred_norm_group_id)
        ? preferred_norm_group_id
        : payload.snapshot.norm_groups.some((group) => group.id === selected_norm_group_id)
          ? selected_norm_group_id
          : payload.snapshot.norm_groups[0]?.id) ?? "";

    set_snapshot(payload.snapshot);
    set_selected_model_id(next_model_id);
    set_model_form(build_model_form(payload.snapshot.models.find((model) => model.id === next_model_id) ?? payload.snapshot.models[0] ?? null));
    set_selected_norm_group_id(next_norm_group_id);
    set_selected_assessment_ids((current) =>
      current.filter((assessment_id) => payload.snapshot!.assessments.some((assessment) => assessment.assessment_id === assessment_id)),
    );
    set_message(next_message ?? payload.message ?? "");
  }

  function patch_config(updater: (config: ScoringModelConfig) => ScoringModelConfig) {
    set_model_form((current) =>
      current
        ? {
            ...current,
            config: updater(current.config),
          }
        : current,
    );
  }

  function create_draft(engine_mode: ScoringEngineMode) {
    start_transition(async () => {
      const response = await fetch("/api/admin/scoring", {
        body: JSON.stringify({
          engine_mode,
          source_model_id: selected_model?.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; model?: ScoringModelDto };

      if (!response.ok || !payload.model) {
        set_message(payload.message ?? "Unable to create a draft scoring model.");
        return;
      }

      await refresh_snapshot(payload.message ?? "Draft scoring model created.", payload.model.id);
    });
  }

  function save_model() {
    if (!model_form) {
      return;
    }

    let parsed_default_ranges: unknown;
    let parsed_role_ranges: unknown;

    try {
      parsed_default_ranges = JSON.parse(model_form.default_ideal_ranges_json);
      parsed_role_ranges = JSON.parse(model_form.role_family_ideal_ranges_json);
    } catch {
      set_message("Ideal range JSON must be valid before saving.");
      return;
    }

    start_transition(async () => {
      const response = await fetch(`/api/admin/scoring/${model_form.id}`, {
        body: JSON.stringify({
          config: {
            ...model_form.config,
            role_fit: {
              ...model_form.config.role_fit,
              default_ideal_ranges: parsed_default_ranges,
              role_family_ideal_ranges: parsed_role_ranges,
            },
          },
          engine_mode: model_form.engine_mode,
          name: model_form.name,
          notes: model_form.notes,
          version_label: model_form.version_label,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json()) as { message?: string; model?: ScoringModelDto };

      if (!response.ok || !payload.model) {
        set_message(payload.message ?? "Unable to save the scoring model.");
        return;
      }

      await refresh_snapshot(payload.message ?? "Scoring model updated.", payload.model.id);
    });
  }

  function publish_model(target_status: "CHALLENGER" | "LIVE") {
    if (!selected_model) {
      return;
    }

    start_transition(async () => {
      const response = await fetch(`/api/admin/scoring/${selected_model.id}/publish`, {
        body: JSON.stringify({ target_status }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; model?: ScoringModelDto };

      if (!response.ok || !payload.model) {
        set_message(payload.message ?? "Unable to publish the scoring model.");
        return;
      }

      await refresh_snapshot(payload.message ?? "Scoring model published.", payload.model.id);
    });
  }

  function archive_model() {
    if (!selected_model) {
      return;
    }

    start_transition(async () => {
      const response = await fetch(`/api/admin/scoring/${selected_model.id}/archive`, {
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; model?: ScoringModelDto };

      if (!response.ok || !payload.model) {
        set_message(payload.message ?? "Unable to archive the scoring model.");
        return;
      }

      await refresh_snapshot(payload.message ?? "Scoring model archived.");
    });
  }

  function run_scoring(assessment_id: string) {
    start_transition(async () => {
      const response = await fetch("/api/admin/scoring/run", {
        body: JSON.stringify({
          assessment_id,
          model_id: selected_model?.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        set_message(payload.message ?? "Unable to run scoring.");
        return;
      }

      await refresh_snapshot(payload.message ?? "Scoring run completed.");
    });
  }

  function create_norm_group() {
    start_transition(async () => {
      const response = await fetch("/api/admin/scoring/norm-groups", {
        body: JSON.stringify({
          description: new_norm_group_description,
          name: new_norm_group_name,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { group?: { id: string }; message?: string };

      if (!response.ok || !payload.group) {
        set_message(payload.message ?? "Unable to create the norm group.");
        return;
      }

      await refresh_snapshot(payload.message ?? "Norm group created.", undefined, payload.group.id);
    });
  }

  function assign_selected_assessments() {
    if (!selected_norm_group_id || !selected_assessment_ids.length) {
      set_message("Select at least one assessment and a norm group before assigning.");
      return;
    }

    start_transition(async () => {
      const response = await fetch(`/api/admin/scoring/norm-groups/${selected_norm_group_id}/assign`, {
        body: JSON.stringify({
          assessment_ids: selected_assessment_ids,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        set_message(payload.message ?? "Unable to assign assessments to the norm group.");
        return;
      }

      await refresh_snapshot(payload.message ?? "Assessments assigned to the norm group.");
    });
  }

  function recompute_norm_group(norm_group_id: string) {
    start_transition(async () => {
      const response = await fetch(`/api/admin/scoring/norm-groups/${norm_group_id}/recompute`, {
        body: JSON.stringify({
          model_id: selected_model?.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        set_message(payload.message ?? "Unable to recompute norm statistics.");
        return;
      }

      await refresh_snapshot(payload.message ?? "Norm statistics recomputed.");
    });
  }

  if (!selected_model || !model_form) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-sm text-brand-black/70">No scoring models exist yet.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button disabled={is_pending} onClick={() => create_draft("PHASE_A_CLASSICAL")} type="button">
              Create classical draft
            </Button>
            <Button disabled={is_pending} onClick={() => create_draft("PHASE_B_HYBRID_IRT")} type="button" variant="outline">
              Create hybrid IRT draft
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <Card>
          <CardHeader>
            <Badge tone="red">Implemented in Step 3</Badge>
            <CardTitle className="mt-3">Scoring model versions</CardTitle>
            <CardDescription>Draft, challenger, and live engine versions with explicit publish control and auditable run history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button disabled={is_pending} onClick={() => create_draft("PHASE_A_CLASSICAL")} type="button">
                New classical draft
              </Button>
              <Button disabled={is_pending} onClick={() => create_draft("PHASE_B_HYBRID_IRT")} type="button" variant="outline">
                New hybrid IRT draft
              </Button>
            </div>
            <div className="space-y-3">
              {snapshot.models.map((model) => (
                <button
                  className={`w-full rounded-[1.4rem] border px-4 py-4 text-left transition ${
                    model.id === selected_model.id
                      ? "border-brand-red bg-brand-red/8"
                      : "border-brand-black/10 bg-brand-grey hover:border-brand-red/35"
                  }`}
                  key={model.id}
                  onClick={() => {
                    set_selected_model_id(model.id);
                    set_model_form(build_model_form(model));
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{model.version_label}</p>
                    <Badge
                      tone={
                        model.status === "LIVE"
                          ? "success"
                          : model.status === "CHALLENGER"
                            ? "neutral"
                            : model.status === "DRAFT"
                              ? "red"
                              : "neutral"
                      }
                    >
                      {model.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-brand-black/75">{model.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brand-black/50">
                    {model.engine_mode.replaceAll("_", " ")} • {model.run_count} runs
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge tone={selected_model.status === "LIVE" ? "success" : selected_model.status === "DRAFT" ? "red" : "neutral"}>
              {selected_model.status}
            </Badge>
            <CardTitle className="mt-3">Scoring governance</CardTitle>
            <CardDescription>
              Control accuracy and speed weighting, Phase B IRT/CAT parameters, fit thresholds, quality gates, and explanation settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">Model name</span>
                <input
                  className={input_class_name}
                  onChange={(event) => set_model_form((current) => (current ? { ...current, name: event.target.value } : current))}
                  value={model_form.name}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">Version label</span>
                <input
                  className={input_class_name}
                  onChange={(event) => set_model_form((current) => (current ? { ...current, version_label: event.target.value } : current))}
                  value={model_form.version_label}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">Engine mode</span>
                <select
                  className={input_class_name}
                  onChange={(event) =>
                    set_model_form((current) =>
                      current
                        ? {
                            ...current,
                            config: {
                              ...current.config,
                              cat: {
                                ...current.config.cat,
                                enabled: event.target.value === "PHASE_B_HYBRID_IRT",
                              },
                            },
                            engine_mode: event.target.value as ScoringEngineMode,
                          }
                        : current,
                    )
                  }
                  value={model_form.engine_mode}
                >
                  <option value="PHASE_A_CLASSICAL">Phase A Classical</option>
                  <option value="PHASE_B_HYBRID_IRT">Phase B Hybrid IRT</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">Notes</span>
                <input
                  className={input_class_name}
                  onChange={(event) => set_model_form((current) => (current ? { ...current, notes: event.target.value } : current))}
                  value={model_form.notes}
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <MetricCard title="Cognitive weighting">
                <NumericField
                  label="Accuracy %"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      cognitive: {
                        ...config.cognitive,
                        accuracy_weight_pct: value,
                      },
                    }))
                  }
                  value={model_form.config.cognitive.accuracy_weight_pct}
                />
                <NumericField
                  label="Speed %"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      cognitive: {
                        ...config.cognitive,
                        speed_weight_pct: value,
                      },
                    }))
                  }
                  value={model_form.config.cognitive.speed_weight_pct}
                />
                <NumericField
                  label="Speed floor %"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      cognitive: {
                        ...config.cognitive,
                        speed_floor_pct: value,
                      },
                    }))
                  }
                  value={model_form.config.cognitive.speed_floor_pct}
                />
              </MetricCard>

              <MetricCard title="Execution weighting">
                <NumericField
                  label="Self-report %"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      execution: {
                        ...config.execution,
                        self_report_weight_pct: value,
                      },
                    }))
                  }
                  value={model_form.config.execution.self_report_weight_pct}
                />
                <NumericField
                  label="Scenario %"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      execution: {
                        ...config.execution,
                        scenario_weight_pct: value,
                      },
                    }))
                  }
                  value={model_form.config.execution.scenario_weight_pct}
                />
                <ToggleField
                  checked={model_form.config.transparent_explanations}
                  label="Transparent score explanations"
                  onChange={(checked) =>
                    patch_config((config) => ({
                      ...config,
                      transparent_explanations: checked,
                    }))
                  }
                />
              </MetricCard>

              <MetricCard title="Fit thresholds">
                <NumericField
                  label="Strong fit min"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      fit_thresholds: {
                        ...config.fit_thresholds,
                        strong_fit_min: value,
                      },
                    }))
                  }
                  value={model_form.config.fit_thresholds.strong_fit_min}
                />
                <NumericField
                  label="Fit min"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      fit_thresholds: {
                        ...config.fit_thresholds,
                        fit_min: value,
                      },
                    }))
                  }
                  value={model_form.config.fit_thresholds.fit_min}
                />
                <NumericField
                  label="Develop min"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      fit_thresholds: {
                        ...config.fit_thresholds,
                        develop_min: value,
                      },
                    }))
                  }
                  value={model_form.config.fit_thresholds.develop_min}
                />
              </MetricCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <MetricCard title="IRT params">
                <NumericField
                  label="Theta min"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      irt: {
                        ...config.irt,
                        theta_min: value,
                      },
                    }))
                  }
                  value={model_form.config.irt.theta_min}
                />
                <NumericField
                  label="Theta max"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      irt: {
                        ...config.irt,
                        theta_max: value,
                      },
                    }))
                  }
                  value={model_form.config.irt.theta_max}
                />
                <NumericField
                  label="Iterations"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      irt: {
                        ...config.irt,
                        max_iterations: value,
                      },
                    }))
                  }
                  value={model_form.config.irt.max_iterations}
                />
                <NumericField
                  label="Convergence"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      irt: {
                        ...config.irt,
                        convergence_delta: value,
                      },
                    }))
                  }
                  value={model_form.config.irt.convergence_delta}
                />
              </MetricCard>

              <MetricCard title="CAT config">
                <ToggleField
                  checked={model_form.config.cat.enabled}
                  label="CAT enabled"
                  onChange={(checked) =>
                    patch_config((config) => ({
                      ...config,
                      cat: {
                        ...config.cat,
                        enabled: checked,
                      },
                    }))
                  }
                />
                <NumericField
                  label="Min items"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      cat: {
                        ...config.cat,
                        min_items: value,
                      },
                    }))
                  }
                  value={model_form.config.cat.min_items}
                />
                <NumericField
                  label="Max items"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      cat: {
                        ...config.cat,
                        max_items: value,
                      },
                    }))
                  }
                  value={model_form.config.cat.max_items}
                />
                <NumericField
                  label="Target SE"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      cat: {
                        ...config.cat,
                        target_standard_error: value,
                      },
                    }))
                  }
                  value={model_form.config.cat.target_standard_error}
                />
              </MetricCard>

              <MetricCard title="Quality and development">
                <NumericField
                  label="Max flags before invalidation"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      quality: {
                        ...config.quality,
                        max_flags_before_invalidation: value,
                      },
                    }))
                  }
                  value={model_form.config.quality.max_flags_before_invalidation}
                />
                <NumericField
                  label="Straight-line threshold"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      quality: {
                        ...config.quality,
                        max_straight_line_count: value,
                      },
                    }))
                  }
                  value={model_form.config.quality.max_straight_line_count}
                />
                <NumericField
                  label="Gap percentile threshold"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      development: {
                        ...config.development,
                        gap_percentile_threshold: value,
                      },
                    }))
                  }
                  value={model_form.config.development.gap_percentile_threshold}
                />
                <NumericField
                  label="High-stakes gap threshold"
                  onChange={(value) =>
                    patch_config((config) => ({
                      ...config,
                      development: {
                        ...config.development,
                        high_stakes_gap_threshold: value,
                      },
                    }))
                  }
                  value={model_form.config.development.high_stakes_gap_threshold}
                />
              </MetricCard>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">Default ideal ranges JSON</span>
                <textarea
                  className={`${input_class_name} min-h-44`}
                  onChange={(event) =>
                    set_model_form((current) =>
                      current
                        ? {
                            ...current,
                            default_ideal_ranges_json: event.target.value,
                          }
                        : current,
                    )
                  }
                  value={model_form.default_ideal_ranges_json}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">Role-family ideal range overrides JSON</span>
                <textarea
                  className={`${input_class_name} min-h-44`}
                  onChange={(event) =>
                    set_model_form((current) =>
                      current
                        ? {
                            ...current,
                            role_family_ideal_ranges_json: event.target.value,
                          }
                        : current,
                    )
                  }
                  value={model_form.role_family_ideal_ranges_json}
                />
              </label>
            </div>

            <div className="rounded-[1.5rem] bg-brand-grey p-4 text-sm leading-7 text-brand-black/78">
              <p>Permissible use matrix</p>
              <p>
                Personality for hiring: {model_form.engine_mode === "PHASE_B_HYBRID_IRT" ? "enabled with Thurstonian Phase B" : "blocked in Phase A"}
              </p>
              <p>Motivators for hiring: {model_form.config.permissible_use.motivation_allowed_for_hiring ? "enabled" : "development only"}</p>
              <p>
                Leadership for hiring: {model_form.config.permissible_use.leadership_requires_senior_role ? "senior roles only" : "available for all role families"}
              </p>
            </div>

            {message ? <p className="text-sm text-brand-red">{message}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button disabled={is_pending} onClick={save_model} type="button">
                Save model
              </Button>
              <Button disabled={is_pending} onClick={() => publish_model("LIVE")} type="button" variant="secondary">
                Publish live
              </Button>
              <Button disabled={is_pending} onClick={() => publish_model("CHALLENGER")} type="button" variant="outline">
                Publish challenger
              </Button>
              <Button disabled={is_pending} onClick={archive_model} type="button" variant="danger">
                Archive
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card>
          <CardHeader>
            <Badge tone="red">Assessment scoring</Badge>
            <CardTitle className="mt-3">Run scoring and inspect outputs</CardTitle>
            <CardDescription>Score completed or invalidated assessments against the selected engine version and review recommendations instantly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {snapshot.assessments.map((assessment) => {
                const checked = selected_assessment_ids.includes(assessment.assessment_id);

                return (
                  <div className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey p-4" key={assessment.assessment_id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <label className="flex items-center gap-3 text-sm font-semibold text-brand-black">
                          <input
                            checked={checked}
                            onChange={() =>
                              set_selected_assessment_ids((current) =>
                                current.includes(assessment.assessment_id)
                                  ? current.filter((entry) => entry !== assessment.assessment_id)
                                  : [...current, assessment.assessment_id],
                              )
                            }
                            type="checkbox"
                          />
                          {assessment.candidate_name}
                        </label>
                        <p className="text-sm text-brand-black/75">{assessment.role_family_name}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-brand-black/50">
                          {assessment.status} • {assessment.assessment_version_label}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {assessment.latest_recommendation ? <Badge tone="neutral">{assessment.latest_recommendation}</Badge> : null}
                        <Button disabled={is_pending} onClick={() => run_scoring(assessment.assessment_id)} type="button" variant="outline">
                          Run selected model
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-brand-black/75 md:grid-cols-4">
                      <p>Latest model: {assessment.latest_run_model_label ?? "Not scored"}</p>
                      <p>Run status: {assessment.latest_run_status ?? "n/a"}</p>
                      <p>Fit score: {assessment.latest_fit_score_pct ?? "n/a"}</p>
                      <p>Quality flags: {assessment.quality_flag_count}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge tone="red">Norm management</Badge>
            <CardTitle className="mt-3">Norm groups and recomputation</CardTitle>
            <CardDescription>Create norm cohorts, assign assessments, and recompute z-score baselines for the active model version.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3">
              <input
                className={input_class_name}
                onChange={(event) => set_new_norm_group_name(event.target.value)}
                placeholder="Norm group name"
                value={new_norm_group_name}
              />
              <textarea
                className={`${input_class_name} min-h-28`}
                onChange={(event) => set_new_norm_group_description(event.target.value)}
                placeholder="Norm group description"
                value={new_norm_group_description}
              />
              <Button disabled={is_pending} onClick={create_norm_group} type="button">
                Create norm group
              </Button>
            </div>

            <label className="space-y-2 text-sm">
              <span className="font-semibold">Assign selected assessments to</span>
              <select
                className={input_class_name}
                onChange={(event) => set_selected_norm_group_id(event.target.value)}
                value={selected_norm_group_id}
              >
                {snapshot.norm_groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={is_pending} onClick={assign_selected_assessments} type="button" variant="outline">
              Assign selected assessments
            </Button>

            <div className="space-y-3">
              {snapshot.norm_groups.map((group) => (
                <div className="rounded-[1.3rem] border border-brand-black/10 bg-brand-grey p-4" key={group.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{group.name}</p>
                      <p className="mt-1 text-sm text-brand-black/75">{group.description}</p>
                    </div>
                    <Button disabled={is_pending} onClick={() => recompute_norm_group(group.id)} type="button" variant="ghost">
                      Recompute
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-brand-black/75 md:grid-cols-3">
                    <p>Members: {group.member_count}</p>
                    <p>Statistics: {group.statistic_count}</p>
                    <p>Last computed: {group.latest_computed_at ? new Date(group.latest_computed_at).toLocaleString() : "Not yet"}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <Badge tone="red">Reliability</Badge>
            <CardTitle className="mt-3">Cronbach alpha by sub-dimension</CardTitle>
            <CardDescription>Reliability is recomputed from administered forms and shown alongside the current scoring model’s evidence base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.reliability.length ? (
              snapshot.reliability.map((entry) => (
                <div className="rounded-[1.2rem] border border-brand-black/10 bg-brand-grey px-4 py-3 text-sm" key={entry.sub_dimension_id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{entry.sub_dimension_name}</p>
                    <Badge tone={entry.alpha !== null && entry.alpha >= 0.75 ? "success" : "neutral"}>
                      {entry.alpha !== null ? `alpha ${entry.alpha}` : "alpha n/a"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-brand-black/75">
                    {entry.layer_code} • {entry.respondent_count} respondents
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-brand-black/70">Reliability coefficients will appear after scoring data accumulates across respondents.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge tone="red">Recent runs</Badge>
            <CardTitle className="mt-3">Transparent score explanations</CardTitle>
            <CardDescription>Review quality gates, included and excluded layers, fit drivers, constraints, and generated development gaps from the latest runs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.recent_runs.map((run) => {
              const outputs = run.step_outputs ?? {};
              const role_fit = typeof outputs.role_fit === "object" && outputs.role_fit ? (outputs.role_fit as Record<string, unknown>) : null;
              const permissible_use =
                typeof outputs.permissible_use === "object" && outputs.permissible_use
                  ? (outputs.permissible_use as Record<string, unknown>)
                  : null;

              return (
                <div className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey p-4" key={run.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{run.candidate_name}</p>
                      <p className="mt-1 text-sm text-brand-black/75">
                        {run.role_family_name} • {run.model_label}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Badge tone={run.status === "COMPLETED" ? "success" : run.status === "INVALIDATED" ? "red" : "neutral"}>{run.status}</Badge>
                      {run.recommendation ? <Badge tone="neutral">{run.recommendation}</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-brand-black/75 md:grid-cols-3">
                    <p>Fit score: {run.fit_score_pct ?? "n/a"}</p>
                    <p>Quality gate: {run.quality_gate_passed ? "passed" : "failed"}</p>
                    <p>Completed: {run.completed_at ? new Date(run.completed_at).toLocaleString() : "Pending"}</p>
                  </div>
                  {role_fit ? (
                    <div className="mt-3 rounded-[1.1rem] bg-brand-white px-4 py-3 text-sm text-brand-black/75">
                      <p>Included layers: {Array.isArray(role_fit.included_layers) ? role_fit.included_layers.join(", ") : "n/a"}</p>
                      <p>Excluded layers: {Array.isArray(role_fit.excluded_layers) ? role_fit.excluded_layers.join(", ") : "n/a"}</p>
                    </div>
                  ) : null}
                  {permissible_use ? (
                    <div className="mt-3 rounded-[1.1rem] bg-brand-white px-4 py-3 text-sm text-brand-black/75">
                      <p>
                        Hiring exclusions:{" "}
                        {Array.isArray(permissible_use.excluded_layers) ? permissible_use.excluded_layers.join(", ") : "None"}
                      </p>
                    </div>
                  ) : null}
                  {run.invalid_reason ? <p className="mt-3 text-sm text-brand-red">{run.invalid_reason}</p> : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-[1.5rem] border border-brand-black/10 bg-brand-grey p-4">
      <p className="mb-3 text-sm font-semibold text-brand-black">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function NumericField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span>{label}</span>
      <input
        className={input_class_name}
        onChange={(event) => onChange(Number(event.target.value))}
        step="any"
        type="number"
        value={value}
      />
    </label>
  );
}

function ToggleField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-brand-black">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}

function build_model_form(model: ScoringModelDto | null): ScoringModelForm | null {
  if (!model) {
    return null;
  }

  return {
    config: model.config,
    default_ideal_ranges_json: JSON.stringify(model.config.role_fit.default_ideal_ranges, null, 2),
    engine_mode: model.engine_mode,
    id: model.id,
    name: model.name,
    notes: model.notes ?? "",
    role_family_ideal_ranges_json: JSON.stringify(model.config.role_fit.role_family_ideal_ranges, null, 2),
    version_label: model.version_label,
  };
}
