"use client";

import type { ItemType } from "@prisma/client";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AssessmentVersionDto,
  RoleFamilyAssessmentOverride,
  SectionSnapshotEditor,
} from "@/lib/assessment-configuration-types";

type RoleFamilyOption = {
  id: string;
  name: string;
};

type LayerInventory = {
  available_item_count: number;
  code: string;
  name: string;
};

const editable_item_types: ItemType[] = ["MCQ", "FORCED_CHOICE_TRIAD", "Q_SORT", "LIKERT", "SCENARIO"];

export function AssessmentConfigurationManager({
  initial_versions,
  layers,
  role_families,
}: {
  initial_versions: AssessmentVersionDto[];
  layers: LayerInventory[];
  role_families: RoleFamilyOption[];
}) {
  const [versions, set_versions] = useState(initial_versions);
  const [selected_version_id, set_selected_version_id] = useState(initial_versions[0]?.id ?? "");
  const [selected_role_family_id, set_selected_role_family_id] = useState(role_families[0]?.id ?? "");
  const [message, set_message] = useState("");
  const [is_pending, start_transition] = useTransition();

  const selected_version = useMemo(
    () => versions.find((version) => version.id === selected_version_id) ?? versions[0] ?? null,
    [selected_version_id, versions],
  );

  const selected_role_family_override = useMemo(() => {
    if (!selected_version || !selected_role_family_id) {
      return null;
    }

    return selected_version.scoring_config_snapshot.role_family_overrides?.[selected_role_family_id] ?? null;
  }, [selected_role_family_id, selected_version]);

  const effective_preview = useMemo(() => {
    if (!selected_version) {
      return [];
    }

    const section_overrides = selected_role_family_override?.section_overrides ?? {};

    return selected_version.sections_snapshot
      .map((section) => {
        const override = section_overrides[section.layer_code] ?? {};
        return {
          ...section,
          ...override,
          item_type_filters: override.item_type_filters ?? section.item_type_filters,
          tag_filters: override.tag_filters ?? section.tag_filters,
          time_limit_seconds: override.time_limit_seconds ?? section.time_limit_seconds,
        };
      })
      .sort((left, right) => left.order - right.order);
  }, [selected_role_family_override, selected_version]);

  function patch_selected_version(updater: (current: AssessmentVersionDto) => AssessmentVersionDto) {
    set_versions((current) =>
      current.map((version) => (version.id === selected_version_id ? updater(version) : version)),
    );
  }

  function update_base_section(layer_code: string, updater: (current: SectionSnapshotEditor) => SectionSnapshotEditor) {
    patch_selected_version((version) => ({
      ...version,
      sections_snapshot: version.sections_snapshot.map((section) => (section.layer_code === layer_code ? updater(section) : section)),
    }));
  }

  function update_role_family_override(
    role_family_id: string,
    updater: (current: RoleFamilyAssessmentOverride) => RoleFamilyAssessmentOverride,
  ) {
    patch_selected_version((version) => ({
      ...version,
      scoring_config_snapshot: {
        ...version.scoring_config_snapshot,
        role_family_overrides: {
          ...(version.scoring_config_snapshot.role_family_overrides ?? {}),
          [role_family_id]: updater(version.scoring_config_snapshot.role_family_overrides?.[role_family_id] ?? {}),
        },
      },
    }));
  }

  function update_override_section(
    role_family_id: string,
    layer_code: string,
    updater: (current: NonNullable<RoleFamilyAssessmentOverride["section_overrides"]>[string]) => NonNullable<
      RoleFamilyAssessmentOverride["section_overrides"]
    >[string],
  ) {
    update_role_family_override(role_family_id, (current) => ({
      ...current,
      section_overrides: {
        ...(current.section_overrides ?? {}),
        [layer_code]: updater(current.section_overrides?.[layer_code] ?? {}),
      },
    }));
  }

  function create_draft() {
    start_transition(async () => {
      const response = await fetch("/api/admin/assessment-configuration", {
        body: JSON.stringify({
          source_version_id: selected_version?.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; version?: AssessmentVersionDto };

      if (!response.ok || !payload.version) {
        set_message(payload.message ?? "Unable to create a draft assessment version.");
        return;
      }

      set_versions((current) => [payload.version!, ...current]);
      set_selected_version_id(payload.version.id);
      set_message(payload.message ?? "Draft assessment version created.");
    });
  }

  function save_version() {
    if (!selected_version) {
      return;
    }

    start_transition(async () => {
      const response = await fetch(`/api/admin/assessment-configuration/${selected_version.id}`, {
        body: JSON.stringify({
          scoring_config_snapshot: selected_version.scoring_config_snapshot,
          sections_snapshot: selected_version.sections_snapshot,
          version_label: selected_version.version_label,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json()) as { message?: string; version?: AssessmentVersionDto };

      if (!response.ok || !payload.version) {
        set_message(payload.message ?? "Unable to save the assessment configuration.");
        return;
      }

      set_versions((current) => current.map((version) => (version.id === payload.version!.id ? payload.version! : version)));
      set_message(payload.message ?? "Assessment configuration saved.");
    });
  }

  function publish_version() {
    if (!selected_version) {
      return;
    }

    start_transition(async () => {
      const response = await fetch(`/api/admin/assessment-configuration/${selected_version.id}/publish`, {
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; version?: AssessmentVersionDto };

      if (!response.ok || !payload.version) {
        set_message(payload.message ?? "Unable to publish the assessment version.");
        return;
      }

      set_versions((current) =>
        current.map((version) =>
          version.id === payload.version!.id
            ? payload.version!
            : version.status === "PUBLISHED"
              ? { ...version, status: "ARCHIVED" }
              : version,
        ),
      );
      set_message(payload.message ?? "Assessment version published.");
    });
  }

  function archive_version() {
    if (!selected_version) {
      return;
    }

    start_transition(async () => {
      const response = await fetch(`/api/admin/assessment-configuration/${selected_version.id}/archive`, {
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; version?: AssessmentVersionDto };

      if (!response.ok || !payload.version) {
        set_message(payload.message ?? "Unable to archive the assessment version.");
        return;
      }

      set_versions((current) => current.map((version) => (version.id === payload.version!.id ? payload.version! : version)));
      set_message(payload.message ?? "Assessment version archived.");
    });
  }

  if (!selected_version) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-sm text-brand-black/70">No assessment versions exist yet.</p>
          <Button className="mt-4" onClick={create_draft} type="button">
            Create first draft
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Badge tone="red">Implemented in Step 2</Badge>
            <CardTitle className="mt-3">Assessment versions</CardTitle>
            <CardDescription>Create drafts, manage publish state, and keep a previewable history of runtime configurations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button disabled={is_pending} onClick={create_draft} type="button">
              Create draft from selected version
            </Button>
            <div className="space-y-3">
              {versions.map((version) => (
                <button
                  className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                    version.id === selected_version.id
                      ? "border-brand-red bg-brand-red/8"
                      : "border-brand-black/10 bg-brand-grey hover:border-brand-red/40"
                  }`}
                  key={version.id}
                  onClick={() => set_selected_version_id(version.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{version.version_label}</p>
                    <Badge tone={version.status === "PUBLISHED" ? "success" : version.status === "DRAFT" ? "red" : "neutral"}>
                      {version.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-brand-black/70">
                    {version.sections_snapshot.length} configured sections, {version.usage_campaign_count} campaigns, {version.assessment_count} assessments.
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Effective preview</CardTitle>
            <CardDescription>Preview the selected role-family override merged with the draft base version.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="w-full rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
              onChange={(event) => set_selected_role_family_id(event.target.value)}
              value={selected_role_family_id}
            >
              {role_families.map((role_family) => (
                <option key={role_family.id} value={role_family.id}>
                  {role_family.name}
                </option>
              ))}
            </select>
            <div className="space-y-3">
              {effective_preview.map((section) => (
                <div className="rounded-[1.4rem] bg-brand-grey p-4" key={`preview-${section.layer_code}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{section.layer_code}</p>
                    <p className="text-sm text-brand-black/65">Order {section.order}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-brand-black/72">
                    {section.enabled ? "Enabled" : "Disabled"} | {section.item_count} items | {section.time_limit_seconds ?? 0} sec |{" "}
                    {section.item_type_filters.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Version controls</CardTitle>
            <CardDescription>Draft edit, publish, and archive controls for the currently selected version.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-semibold">Version label</span>
              <input
                className="w-full rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) =>
                  patch_selected_version((version) => ({
                    ...version,
                    version_label: event.target.value,
                  }))
                }
                value={selected_version.version_label}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <NumericField
                label="Total cap (sec)"
                onChange={(value) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      total_battery_time_cap_seconds: value,
                    },
                  }))
                }
                value={selected_version.scoring_config_snapshot.total_battery_time_cap_seconds}
              />
              <NumericField
                label="Dropout threshold %"
                onChange={(value) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      dropout_threshold_pct: value,
                    },
                  }))
                }
                value={selected_version.scoring_config_snapshot.dropout_threshold_pct}
              />
              <select
                className="rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      break_point_after_layer: event.target.value || null,
                    },
                  }))
                }
                value={selected_version.scoring_config_snapshot.break_point_after_layer ?? ""}
              >
                <option value="">No break point</option>
                {layers.map((layer) => (
                  <option key={layer.code} value={layer.code}>
                    {layer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <NumericField
                label="Speed anomaly (sec)"
                onChange={(value) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      anti_gaming_thresholds: {
                        ...version.scoring_config_snapshot.anti_gaming_thresholds,
                        speed_anomaly_seconds: value,
                      },
                    },
                  }))
                }
                value={selected_version.scoring_config_snapshot.anti_gaming_thresholds.speed_anomaly_seconds}
              />
              <NumericField
                label="Straight-line count"
                onChange={(value) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      anti_gaming_thresholds: {
                        ...version.scoring_config_snapshot.anti_gaming_thresholds,
                        max_straight_line_count: value,
                      },
                    },
                  }))
                }
                value={selected_version.scoring_config_snapshot.anti_gaming_thresholds.max_straight_line_count}
              />
              <NumericField
                label="Invalidate after flags"
                onChange={(value) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      anti_gaming_thresholds: {
                        ...version.scoring_config_snapshot.anti_gaming_thresholds,
                        max_flags_before_invalidation: value,
                      },
                    },
                  }))
                }
                value={selected_version.scoring_config_snapshot.anti_gaming_thresholds.max_flags_before_invalidation}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ToggleField
                checked={selected_version.scoring_config_snapshot.proctor_mode_default}
                label="Proctor mode"
                onChange={(checked) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      proctor_mode_default: checked,
                    },
                  }))
                }
              />
              <ToggleField
                checked={selected_version.scoring_config_snapshot.per_item_timers_enabled}
                label="Per-item timers"
                onChange={(checked) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      per_item_timers_enabled: checked,
                    },
                  }))
                }
              />
              <ToggleField
                checked={selected_version.scoring_config_snapshot.question_randomisation}
                label="Question randomisation"
                onChange={(checked) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      question_randomisation: checked,
                    },
                  }))
                }
              />
              <ToggleField
                checked={selected_version.scoring_config_snapshot.section_randomisation}
                label="Section randomisation"
                onChange={(checked) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      section_randomisation: checked,
                    },
                  }))
                }
              />
              <ToggleField
                checked={selected_version.scoring_config_snapshot.pause_resume_rules.allow_pause}
                label="Allow pause"
                onChange={(checked) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      pause_resume_rules: {
                        ...version.scoring_config_snapshot.pause_resume_rules,
                        allow_pause: checked,
                      },
                    },
                  }))
                }
              />
              <ToggleField
                checked={selected_version.scoring_config_snapshot.pause_resume_rules.allow_resume}
                label="Allow resume"
                onChange={(checked) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      pause_resume_rules: {
                        ...version.scoring_config_snapshot.pause_resume_rules,
                        allow_resume: checked,
                      },
                    },
                  }))
                }
              />
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold">Publish notes</span>
              <textarea
                className="min-h-24 w-full rounded-[1.4rem] border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) =>
                  patch_selected_version((version) => ({
                    ...version,
                    scoring_config_snapshot: {
                      ...version.scoring_config_snapshot,
                      publish_notes: event.target.value,
                    },
                  }))
                }
                value={selected_version.scoring_config_snapshot.publish_notes ?? ""}
              />
            </label>

            {message ? <p className="text-sm text-brand-red">{message}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button disabled={is_pending || selected_version.status !== "DRAFT"} onClick={save_version} type="button">
                Save draft
              </Button>
              <Button disabled={is_pending || selected_version.status === "ARCHIVED"} onClick={publish_version} type="button" variant="secondary">
                Publish version
              </Button>
              <Button disabled={is_pending || selected_version.status === "ARCHIVED"} onClick={archive_version} type="button" variant="danger">
                Archive version
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Base sections</CardTitle>
            <CardDescription>Configure the shared section order, enablement, timers, and item mix for the version.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected_version.sections_snapshot
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((section) => {
                const layer = layers.find((entry) => entry.code === section.layer_code);
                return (
                  <div className="rounded-[1.5rem] bg-brand-grey p-4" key={section.layer_code}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{layer?.name ?? section.layer_code}</p>
                        <p className="text-sm text-brand-black/65">{layer?.available_item_count ?? 0} approved items currently available</p>
                      </div>
                      <ToggleField
                        checked={section.enabled}
                        label="Enabled"
                        onChange={(checked) =>
                          update_base_section(section.layer_code, (current) => ({
                            ...current,
                            enabled: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <NumericField
                        label="Order"
                        onChange={(value) =>
                          update_base_section(section.layer_code, (current) => ({
                            ...current,
                            order: value,
                          }))
                        }
                        value={section.order}
                      />
                      <NumericField
                        label="Item count"
                        onChange={(value) =>
                          update_base_section(section.layer_code, (current) => ({
                            ...current,
                            item_count: value,
                          }))
                        }
                        value={section.item_count}
                      />
                      <NumericField
                        label="Time limit (sec)"
                        onChange={(value) =>
                          update_base_section(section.layer_code, (current) => ({
                            ...current,
                            time_limit_seconds: value,
                          }))
                        }
                        value={section.time_limit_seconds ?? 0}
                      />
                      <select
                        className="rounded-[1.2rem] border border-brand-black/15 bg-brand-white px-4 py-3 outline-none focus:border-brand-red"
                        onChange={(event) =>
                          update_base_section(section.layer_code, (current) => ({
                            ...current,
                            pagination_style: event.target.value,
                          }))
                        }
                        value={section.pagination_style ?? "single"}
                      >
                        <option value="single">Single-page items</option>
                        <option value="section">Whole-section page</option>
                      </select>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {editable_item_types.map((item_type) => {
                        const active = section.item_type_filters.includes(item_type);
                        return (
                          <button
                            className={`rounded-full border px-3 py-2 text-sm transition ${
                              active ? "border-brand-red bg-brand-red text-brand-white" : "border-brand-black/12 bg-brand-white"
                            }`}
                            key={`${section.layer_code}-${item_type}`}
                            onClick={() =>
                              update_base_section(section.layer_code, (current) => ({
                                ...current,
                                item_type_filters: active
                                  ? current.item_type_filters.filter((entry) => entry !== item_type)
                                  : [...current.item_type_filters, item_type],
                              }))
                            }
                            type="button"
                          >
                            {item_type}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4">
                      <ToggleField
                        checked={Boolean(section.break_after)}
                        label="Break after this layer"
                        onChange={(checked) =>
                          update_base_section(section.layer_code, (current) => ({
                            ...current,
                            break_after: checked,
                          }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role-family overrides</CardTitle>
            <CardDescription>Override enablement, order, item count, and timers for a specific role family without duplicating the version.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="w-full rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
              onChange={(event) => set_selected_role_family_id(event.target.value)}
              value={selected_role_family_id}
            >
              {role_families.map((role_family) => (
                <option key={role_family.id} value={role_family.id}>
                  {role_family.name}
                </option>
              ))}
            </select>

            {selected_role_family_id ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <NumericField
                    label="Override total cap (sec)"
                    onChange={(value) =>
                      update_role_family_override(selected_role_family_id, (current) => ({
                        ...current,
                        total_battery_time_cap_seconds: value,
                      }))
                    }
                    value={selected_role_family_override?.total_battery_time_cap_seconds ?? selected_version.scoring_config_snapshot.total_battery_time_cap_seconds}
                  />
                  <select
                    className="rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                    onChange={(event) =>
                      update_role_family_override(selected_role_family_id, (current) => ({
                        ...current,
                        break_point_after_layer: event.target.value || null,
                      }))
                    }
                    value={selected_role_family_override?.break_point_after_layer ?? ""}
                  >
                    <option value="">Use base break point</option>
                    {layers.map((layer) => (
                      <option key={`override-${layer.code}`} value={layer.code}>
                        {layer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  {selected_version.sections_snapshot.map((section) => {
                    const override = selected_role_family_override?.section_overrides?.[section.layer_code] ?? {};
                    return (
                      <div className="rounded-[1.5rem] bg-brand-grey p-4" key={`override-${section.layer_code}`}>
                        <p className="font-semibold">{section.layer_code}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <NumericField
                            label="Order"
                            onChange={(value) =>
                              update_override_section(selected_role_family_id, section.layer_code, (current) => ({
                                ...current,
                                order: value,
                              }))
                            }
                            value={override.order ?? section.order}
                          />
                          <NumericField
                            label="Item count"
                            onChange={(value) =>
                              update_override_section(selected_role_family_id, section.layer_code, (current) => ({
                                ...current,
                                item_count: value,
                              }))
                            }
                            value={override.item_count ?? section.item_count}
                          />
                          <NumericField
                            label="Time limit (sec)"
                            onChange={(value) =>
                              update_override_section(selected_role_family_id, section.layer_code, (current) => ({
                                ...current,
                                time_limit_seconds: value,
                              }))
                            }
                            value={override.time_limit_seconds ?? section.time_limit_seconds ?? 0}
                          />
                          <ToggleField
                            checked={override.enabled ?? section.enabled}
                            label="Enabled"
                            onChange={(checked) =>
                              update_override_section(selected_role_family_id, section.layer_code, (current) => ({
                                ...current,
                                enabled: checked,
                              }))
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NumericField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">{label}</span>
      <input
        className="w-full rounded-[1.2rem] border border-brand-black/15 bg-brand-white px-4 py-3 outline-none focus:border-brand-red"
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
    </label>
  );
}

function ToggleField({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-[1.2rem] bg-brand-white px-4 py-3">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span className="text-sm font-semibold">{label}</span>
    </label>
  );
}
