"use client";

import type { ItemReviewStatus, ItemType } from "@prisma/client";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuestionBankItemDto, QuestionBankOption } from "@/lib/question-bank-types";

type SelectOption = {
  label: string;
  value: string;
};

type LayerOption = {
  code: string;
  id: string;
  label: string;
};

type QuestionBankForm = {
  correct_answer: unknown;
  desirability_rating: number;
  difficulty_b: number;
  discrimination_a: number;
  guessing_c: number;
  id: string;
  is_active: boolean;
  item_type: ItemType;
  layer_id: string;
  max_exposure_pct: number;
  options: QuestionBankOption[];
  review_status: ItemReviewStatus;
  scoring_key: string;
  stem: string;
  sub_dimension_id: string;
  tags: string;
  time_limit_seconds: number;
};

const blank_item: QuestionBankForm = {
  correct_answer: null,
  desirability_rating: 4,
  difficulty_b: 0,
  discrimination_a: 1,
  guessing_c: 0.2,
  id: "",
  is_active: true,
  item_type: "MCQ",
  layer_id: "",
  max_exposure_pct: 30,
  options: [{ option_text: "", score_weight: 0 }],
  review_status: "DRAFT",
  scoring_key: "{}",
  stem: "",
  sub_dimension_id: "",
  tags: "{}",
  time_limit_seconds: 60,
};

export function QuestionBankManager({
  initial_items,
  layers,
  role_families,
  sub_dimensions,
}: {
  initial_items: QuestionBankItemDto[];
  layers: LayerOption[];
  role_families: SelectOption[];
  sub_dimensions: Array<SelectOption & { layer_code: string }>;
}) {
  const [items, set_items] = useState(initial_items);
  const [filters, set_filters] = useState({
    item_type: "",
    layer_code: "",
    review_status: "",
    role_family: "",
    search: "",
    sub_dimension_id: "",
  });
  const [selected_ids, set_selected_ids] = useState<string[]>([]);
  const [selected_item, set_selected_item] = useState<QuestionBankItemDto | null>(initial_items[0] ?? null);
  const [form, set_form] = useState<QuestionBankForm>(() => to_form_state(initial_items[0] ?? null, layers));
  const [message, set_message] = useState("");
  const [import_content, set_import_content] = useState("");
  const [import_format, set_import_format] = useState<"csv" | "json">("csv");
  const [import_errors, set_import_errors] = useState<Array<{ line_number: number; message: string }>>([]);
  const [is_pending, start_transition] = useTransition();
  const deferred_search = useDeferredValue(filters.search);

  const current_sub_dimensions = useMemo(
    () => sub_dimensions.filter((entry) => !filters.layer_code || entry.layer_code === filters.layer_code),
    [filters.layer_code, sub_dimensions],
  );
  const selected_layer_code = useMemo(
    () => layers.find((layer) => layer.id === form.layer_id)?.code ?? "",
    [form.layer_id, layers],
  );

  function update_filter(field: keyof typeof filters, value: string) {
    set_filters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function refresh_items(next_filters = filters) {
    start_transition(async () => {
      const params = new URLSearchParams();

      Object.entries(next_filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      const response = await fetch(`/api/admin/question-bank?${params.toString()}`);
      const payload = (await response.json()) as { items?: QuestionBankItemDto[]; message?: string };

      if (!response.ok || !payload.items) {
        set_message(payload.message ?? "Unable to load question bank.");
        return;
      }

      set_items(payload.items);
      if (payload.items.length > 0 && !selected_item) {
        set_selected_item(payload.items[0]);
        set_form(to_form_state(payload.items[0], layers));
      }
    });
  }

  function load_item_for_edit(item: QuestionBankItemDto) {
    set_selected_item(item);
    set_form(to_form_state(item, layers));
  }

  function update_option(index: number, field: string, value: string | number | boolean) {
    set_form((current) => ({
      ...current,
      options: current.options.map((option, option_index) =>
        option_index === index
          ? {
              ...option,
              [field]: value,
            }
          : option,
      ),
    }));
  }

  function add_option() {
    set_form((current) => ({
      ...current,
      options: [...current.options, { option_text: "", score_weight: 0 }],
    }));
  }

  function move_option(index: number, direction: -1 | 1) {
    set_form((current) => {
      const next = [...current.options];
      const target = index + direction;

      if (target < 0 || target >= next.length) {
        return current;
      }

      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, options: next };
    });
  }

  function remove_option(index: number) {
    set_form((current) => ({
      ...current,
      options: current.options.filter((_, option_index) => option_index !== index),
    }));
  }

  function save_item() {
    start_transition(async () => {
      try {
        const payload = {
          correct_answer: parse_json_or_value(form.correct_answer),
          desirability_rating: form.item_type === "FORCED_CHOICE_TRIAD" ? Number(form.desirability_rating) : null,
          difficulty_b: Number(form.difficulty_b),
          discrimination_a: Number(form.discrimination_a),
          guessing_c: Number(form.guessing_c),
          is_active: form.is_active,
          item_type: form.item_type,
          layer_id: form.layer_id,
          max_exposure_pct: Number(form.max_exposure_pct),
          options: form.options.map((option, index) => ({
            ...option,
            display_order: index + 1,
            score_weight: Number(option.score_weight ?? 0),
          })),
          review_status: form.review_status,
          scoring_key: JSON.parse(form.scoring_key || "{}"),
          stem: form.stem,
          sub_dimension_id: form.sub_dimension_id || null,
          tags: JSON.parse(form.tags || "{}"),
          time_limit_seconds: form.time_limit_seconds ? Number(form.time_limit_seconds) : null,
        };

        const response = await fetch(form.id ? `/api/admin/question-bank/${form.id}` : "/api/admin/question-bank", {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: form.id ? "PATCH" : "POST",
        });

        const result = (await response.json()) as { item?: QuestionBankItemDto; message?: string };

        if (!response.ok || !result.item) {
          set_message(result.message ?? "Unable to save item.");
          return;
        }

        set_message(result.message ?? "Item saved.");
        load_item_for_edit(result.item);
        await refresh_items();
      } catch {
        set_message("One of the JSON fields could not be parsed.");
      }
    });
  }

  function run_bulk_status(review_status: ItemReviewStatus) {
    start_transition(async () => {
      const response = await fetch("/api/admin/question-bank/bulk-status", {
        body: JSON.stringify({
          item_ids: selected_ids,
          review_status,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as { message?: string };
      set_message(payload.message ?? "Bulk action completed.");
      set_selected_ids([]);
      await refresh_items();
    });
  }

  function run_import() {
    start_transition(async () => {
      const response = await fetch("/api/admin/question-bank/import", {
        body: JSON.stringify({
          content: import_content,
          format: import_format,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as {
        errors?: Array<{ line_number: number; message: string }>;
        message?: string;
      };

      set_import_errors(payload.errors ?? []);
      set_message(payload.message ?? "Import finished.");
      await refresh_items();
    });
  }

  const visible_items = items.filter((item) =>
    `${item.stem} ${item.layer_name} ${item.sub_dimension_name ?? ""}`.toLowerCase().includes(deferred_search.toLowerCase()),
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Badge tone="red">Implemented in Step 2</Badge>
            <CardTitle className="mt-3">Question Bank Manager</CardTitle>
            <CardDescription>
              Search, filter, bulk manage, import, export, preview, and inspect item version history from one workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => update_filter("search", event.target.value)}
                placeholder="Search stem or construct"
                type="search"
                value={filters.search}
              />
              <select
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => update_filter("layer_code", event.target.value)}
                value={filters.layer_code}
              >
                <option value="">All layers</option>
                {layers.map((layer) => (
                  <option key={layer.code} value={layer.code}>
                    {layer.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => update_filter("sub_dimension_id", event.target.value)}
                value={filters.sub_dimension_id}
              >
                <option value="">All sub-dimensions</option>
                {current_sub_dimensions.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => update_filter("item_type", event.target.value)}
                value={filters.item_type}
              >
                <option value="">All types</option>
                {["MCQ", "FORCED_CHOICE_TRIAD", "Q_SORT", "SCENARIO", "LIKERT"].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => update_filter("review_status", event.target.value)}
                value={filters.review_status}
              >
                <option value="">All review states</option>
                {["DRAFT", "REVIEWED", "APPROVED", "RETIRED"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => update_filter("role_family", event.target.value)}
                value={filters.role_family}
              >
                <option value="">All role-family usage</option>
                {role_families.map((role_family) => (
                  <option key={role_family.value} value={role_family.label}>
                    {role_family.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button disabled={is_pending} onClick={() => refresh_items()} type="button">
                Apply filters
              </Button>
              <Button onClick={() => window.open("/api/admin/question-bank/export?format=csv", "_blank")} type="button" variant="outline">
                Export CSV
              </Button>
              <Button onClick={() => window.open("/api/admin/question-bank/export?format=json", "_blank")} type="button" variant="outline">
                Export JSON
              </Button>
              <Button disabled={!selected_ids.length} onClick={() => run_bulk_status("APPROVED")} type="button" variant="secondary">
                Bulk approve
              </Button>
              <Button disabled={!selected_ids.length} onClick={() => run_bulk_status("RETIRED")} type="button" variant="danger">
                Bulk retire
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3 text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.18em] text-brand-black/55">
                    <th className="px-3">Select</th>
                    <th className="px-3">Layer</th>
                    <th className="px-3">Sub-dimension</th>
                    <th className="px-3">Type</th>
                    <th className="px-3">Stem</th>
                    <th className="px-3">IRT</th>
                    <th className="px-3">Status</th>
                    <th className="px-3">Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {visible_items.map((item) => (
                    <tr
                      className="cursor-pointer rounded-[1.4rem] bg-brand-grey transition hover:bg-brand-white"
                      key={item.id}
                      onClick={() => load_item_for_edit(item)}
                    >
                      <td className="rounded-l-[1.4rem] px-3 py-4">
                        <input
                          checked={selected_ids.includes(item.id)}
                          onChange={(event) =>
                            set_selected_ids((current) =>
                              event.target.checked ? [...current, item.id] : current.filter((entry) => entry !== item.id),
            )
                          }
                          type="checkbox"
                        />
                      </td>
                      <td className="px-3 py-4 text-sm font-semibold">{item.layer_name}</td>
                      <td className="px-3 py-4 text-sm">{item.sub_dimension_name ?? "Mixed / metadata"}</td>
                      <td className="px-3 py-4 text-sm">{item.item_type}</td>
                      <td className="max-w-sm px-3 py-4 text-sm text-brand-black/72">{item.stem.slice(0, 110)}...</td>
                      <td className="px-3 py-4 text-sm">
                        b {item.difficulty_b ?? "NA"} / a {item.discrimination_a ?? "NA"}
                      </td>
                      <td className="px-3 py-4 text-sm">{item.review_status}</td>
                      <td className="rounded-r-[1.4rem] px-3 py-4 text-sm">
                        {item.exposure_count} uses / {item.exposure_pct}% share
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import items</CardTitle>
            <CardDescription>Supports CSV or JSON with line-level error reporting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <select
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => set_import_format(event.target.value as "csv" | "json")}
                value={import_format}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <input
                accept={import_format === "csv" ? ".csv,text/csv" : ".json,application/json"}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    set_import_content(await file.text());
                  }
                }}
                type="file"
              />
            </div>
            <textarea
              className="min-h-44 w-full rounded-[1.5rem] border border-brand-black/15 bg-brand-grey px-4 py-4 outline-none focus:border-brand-red"
              onChange={(event) => set_import_content(event.target.value)}
              placeholder={
                import_format === "csv"
                  ? 'layer_code,sub_dimension_code,item_type,stem,options,scoring_key\nCOGNITIVE,LOGICAL_REASONING,MCQ,"Sample stem","[{""option_text"":""A""}]","{}"'
                  : '[{"layer_code":"COGNITIVE","sub_dimension_code":"LOGICAL_REASONING","item_type":"MCQ","stem":"Sample stem","options":[{"option_text":"A"}]}]'
              }
              value={import_content}
            />
            <Button disabled={is_pending || !import_content.trim()} onClick={run_import} type="button">
              Run import
            </Button>
            {import_errors.length ? (
              <div className="rounded-[1.5rem] border border-brand-red/25 bg-brand-red/8 p-4 text-sm leading-6 text-brand-black/80">
                {import_errors.map((error) => (
                  <p key={`${error.line_number}-${error.message}`}>
                    Line {error.line_number}: {error.message}
                  </p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{form.id ? "Edit item" : "Create item"}</CardTitle>
            <CardDescription>Manage item content, IRT parameters, scoring, tags, and review workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="min-h-36 w-full rounded-[1.5rem] border border-brand-black/15 bg-brand-grey px-4 py-4 outline-none focus:border-brand-red"
              onChange={(event) => set_form((current) => ({ ...current, stem: event.target.value }))}
              placeholder="Item stem"
              value={form.stem}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, layer_id: event.target.value, sub_dimension_id: "" }))}
                value={form.layer_id}
              >
                <option value="">Choose layer</option>
                {layers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, sub_dimension_id: event.target.value }))}
                value={form.sub_dimension_id}
              >
                <option value="">Choose sub-dimension</option>
                {sub_dimensions
                  .filter((entry) => !selected_layer_code || entry.layer_code === selected_layer_code)
                  .map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
              </select>
              <select
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, item_type: event.target.value as ItemType }))}
                value={form.item_type}
              >
                {["MCQ", "FORCED_CHOICE_TRIAD", "Q_SORT", "SCENARIO", "LIKERT"].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, review_status: event.target.value as ItemReviewStatus }))}
                value={form.review_status}
              >
                {["DRAFT", "REVIEWED", "APPROVED", "RETIRED"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <NumericField label="Difficulty b" value={form.difficulty_b} onChange={(value) => set_form((current) => ({ ...current, difficulty_b: value }))} />
              <NumericField
                label="Discrimination a"
                value={form.discrimination_a}
                onChange={(value) => set_form((current) => ({ ...current, discrimination_a: value }))}
              />
              <NumericField label="Guessing c" value={form.guessing_c} onChange={(value) => set_form((current) => ({ ...current, guessing_c: value }))} />
              <NumericField
                label="Time limit (sec)"
                value={form.time_limit_seconds}
                onChange={(value) => set_form((current) => ({ ...current, time_limit_seconds: value }))}
              />
            </div>

            <div className="rounded-[1.5rem] bg-brand-grey p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Options</p>
                <Button onClick={add_option} type="button" variant="outline">
                  Add option
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {form.options.map((option, index) => (
                  <div className="grid gap-3 rounded-[1.2rem] bg-brand-white p-3" key={`option-${index}`}>
                    <textarea
                      className="min-h-24 rounded-[1rem] border border-brand-black/15 bg-brand-grey px-3 py-3 outline-none focus:border-brand-red"
                      onChange={(event) => update_option(index, "option_text", event.target.value)}
                      placeholder="Option text"
                      value={String(option.option_text ?? "")}
                    />
                    <div className="grid gap-3 md:grid-cols-4">
                      <input
                        className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                        onChange={(event) => update_option(index, "score_weight", Number(event.target.value))}
                        placeholder="Score"
                        type="number"
                        value={Number(option.score_weight ?? 0)}
                      />
                      <input
                        className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                        onChange={(event) => update_option(index, "trait", event.target.value)}
                        placeholder="Trait (triads)"
                        type="text"
                        value={String(option.trait ?? "")}
                      />
                      <input
                        className="rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
                        max={5}
                        min={1}
                        onChange={(event) => update_option(index, "desirability_rating", Number(event.target.value))}
                        placeholder="Desirability"
                        type="number"
                        value={Number(option.desirability_rating ?? 4)}
                      />
                      <label className="flex items-center gap-3 rounded-full bg-brand-grey px-4 py-3">
                        <input checked={Boolean(option.is_correct)} onChange={(event) => update_option(index, "is_correct", event.target.checked)} type="checkbox" />
                        <span className="text-sm">Correct</span>
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => move_option(index, -1)} type="button" variant="outline">
                        Move up
                      </Button>
                      <Button onClick={() => move_option(index, 1)} type="button" variant="outline">
                        Move down
                      </Button>
                      <Button onClick={() => remove_option(index)} type="button" variant="danger">
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold">Scoring key JSON</span>
              <textarea
                className="min-h-32 w-full rounded-[1.5rem] border border-brand-black/15 bg-brand-grey px-4 py-4 outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, scoring_key: event.target.value }))}
                value={form.scoring_key}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold">Tags JSON</span>
              <textarea
                className="min-h-32 w-full rounded-[1.5rem] border border-brand-black/15 bg-brand-grey px-4 py-4 outline-none focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, tags: event.target.value }))}
                value={form.tags}
              />
            </label>

            {selected_item ? (
              <div className="rounded-[1.5rem] bg-brand-grey p-4 text-sm leading-6 text-brand-black/75">
                Exposure: {selected_item.exposure_count} uses ({selected_item.exposure_pct}% of assessments). Max exposure threshold:
                {` ${selected_item.max_exposure_pct}`}. Items crossing the threshold auto-retire on update.
              </div>
            ) : null}

            {message ? <p className="text-sm text-brand-red">{message}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button disabled={is_pending} onClick={save_item} type="button">
                {form.id ? "Save item" : "Create item"}
              </Button>
              <Button
                onClick={() => {
                  set_form(blank_item);
                  set_selected_item(null);
                  set_message("");
                }}
                type="button"
                variant="outline"
              >
                New item
              </Button>
            </div>
          </CardContent>
        </Card>

        {selected_item ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Item preview</CardTitle>
                <CardDescription>Candidate-facing preview for the currently selected item.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-7 text-brand-black/80">{selected_item.stem}</p>
                <div className="grid gap-3">
                  {selected_item.options.map((option, index) => (
                    <div className="rounded-[1.2rem] bg-brand-grey px-4 py-3 text-sm" key={`${selected_item.id}-preview-${index}`}>
                      {String(option.option_text ?? option.trait ?? option.score_weight ?? "")}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Version history</CardTitle>
                <CardDescription>Diff-friendly snapshots of prior stems and scoring configurations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected_item.version_history.map((version) => (
                  <div className="rounded-[1.4rem] bg-brand-grey p-4" key={version.id}>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Version {version.version_number}</p>
                      <p className="text-sm text-brand-black/60">{new Date(version.changed_at).toLocaleString("en-IN")}</p>
                    </div>
                    <p className="mt-2 text-sm text-brand-black/70">{version.change_notes ?? "No notes recorded."}</p>
                    <div className="mt-3 grid gap-3">
                      <pre className="overflow-auto rounded-[1rem] bg-brand-white p-3 text-xs leading-6">{version.stem_snapshot}</pre>
                      <pre className="overflow-auto rounded-[1rem] bg-brand-white p-3 text-xs leading-6">
                        {JSON.stringify(version.options_snapshot, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}

function NumericField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">{label}</span>
      <input
        className="w-full rounded-full border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none focus:border-brand-red"
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
    </label>
  );
}

function parse_json_or_value(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function to_form_state(item: QuestionBankItemDto | null, layers: LayerOption[]): QuestionBankForm {
  if (!item) {
    return blank_item;
  }

  return {
    correct_answer: item.correct_answer ?? null,
    desirability_rating: item.desirability_rating ?? 4,
    difficulty_b: item.difficulty_b ?? 0,
    discrimination_a: item.discrimination_a ?? 1,
    guessing_c: item.guessing_c ?? 0.2,
    id: item.id,
    is_active: item.is_active,
    item_type: item.item_type,
    layer_id: layers.find((layer) => layer.code === item.layer_code)?.id ?? "",
    max_exposure_pct: item.max_exposure_pct,
    options: item.options.length ? item.options.map(clone_option) : [{ option_text: "", score_weight: 0 }],
    review_status: item.review_status,
    scoring_key: JSON.stringify(item.scoring_key ?? {}, null, 2),
    stem: item.stem,
    sub_dimension_id: item.sub_dimension_id ?? "",
    tags: JSON.stringify(item.tags ?? {}, null, 2),
    time_limit_seconds: item.time_limit_seconds ?? 60,
  };
}

function clone_option(option: QuestionBankOption): QuestionBankOption {
  return {
    desirability_rating: option.desirability_rating,
    display_order: option.display_order,
    is_correct: option.is_correct,
    option_text: option.option_text,
    rationale: option.rationale,
    score_weight: option.score_weight,
    trait: option.trait,
  };
}
