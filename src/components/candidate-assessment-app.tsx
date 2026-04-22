"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssessmentPublicItem, AssessmentSession, AssessmentSessionSection } from "@/lib/assessment-session";

export function CandidateAssessmentApp({
  initial_session,
  token,
}: {
  initial_session: AssessmentSession;
  token: string;
}) {
  const [session, set_session] = useState(initial_session);
  const [error, set_error] = useState("");
  const [is_pending, start_transition] = useTransition();
  const item_started_at_ref = useRef(0);
  const [dismissed_break_after_section_id, set_dismissed_break_after_section_id] = useState<string | null>(null);
  const [triad_draft, set_triad_draft] = useState<{
    item_id: string | null;
    selection: { least: string | null; most: string | null };
  }>({
    item_id: null,
    selection: { least: null, most: null },
  });
  const [qsort_draft, set_qsort_draft] = useState<{
    assignments: Record<string, string>;
    section_id: string | null;
  }>({
    assignments: {},
    section_id: null,
  });
  const [dragging_option, set_dragging_option] = useState<string | null>(null);

  const current_section = useMemo(() => {
    return session.assessment?.sections.find((section) => section.responses.length < section.items.length) ?? null;
  }, [session.assessment?.sections]);

  const current_item = useMemo(() => {
    if (!current_section || current_section.layer_code === "MOTIVATORS") {
      return null;
    }
    return current_section.items[current_section.responses.length] ?? null;
  }, [current_section]);

  const next_sequence_number = useMemo(() => {
    const all_responses = session.assessment?.sections.flatMap((section) => section.responses) ?? [];
    return (all_responses.reduce((max, response) => Math.max(max, response.sequence_number), 0) ?? 0) + 1;
  }, [session.assessment?.sections]);

  const pending_break = useMemo(() => {
    if (!session.assessment || !current_section) return null;
    const current_index = session.assessment.sections.findIndex((section) => section.id === current_section.id);
    if (current_index <= 0) return null;
    const previous_section = session.assessment.sections[current_index - 1];
    if (!previous_section) return null;
    const completed = previous_section.responses.length >= previous_section.items.length;
    const has_break = previous_section.runtime_config_snapshot?.break_after === true;
    if (!completed || !has_break || dismissed_break_after_section_id === previous_section.id) return null;
    return previous_section;
  }, [current_section, dismissed_break_after_section_id, session.assessment]);

  const triad_selection = useMemo(() => {
    if (!current_item || current_item.item_type !== "FORCED_CHOICE_TRIAD") return { least: null, most: null };
    if (triad_draft.item_id === current_item.id) return triad_draft.selection;
    const existing = current_section?.responses.find((r) => r.item_id === current_item.id);
    if (existing?.response_value && typeof existing.response_value === "object") {
      const v = existing.response_value as Record<string, unknown>;
      if ("least" in v && "most" in v) {
        return { least: typeof v.least === "string" ? v.least : null, most: typeof v.most === "string" ? v.most : null };
      }
    }
    return { least: null, most: null };
  }, [current_item, current_section?.responses, triad_draft]);

  const qsort_assignments = useMemo(() => {
    if (current_section?.layer_code !== "MOTIVATORS") return {};
    if (qsort_draft.section_id === current_section.id) return qsort_draft.assignments;
    return Object.fromEntries(current_section.responses.map((r) => [r.item_id, String(r.response_value)]));
  }, [current_section, qsort_draft]);

  const heartbeat = useEffectEvent(async () => {
    if (session.stage !== "assessment" || !session.assessment) return;
    try {
      await fetch(`/api/assessment/${token}/heartbeat`, {
        body: JSON.stringify({ runtime_metadata: get_runtime_metadata() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch {
      // heartbeat failure is non-critical
    }
  });

  useEffect(() => {
    if (session.stage !== "assessment") return;
    const id = window.setInterval(() => { void heartbeat(); }, 30_000);
    return () => window.clearInterval(id);
  }, [session.stage]);

  useEffect(() => { item_started_at_ref.current = Date.now(); }, [current_item?.id, current_section?.id]);

  async function refresh_session() {
    try {
      const r = await fetch(`/api/assessment/${token}`);
      const p = (await r.json()) as { message?: string; session?: AssessmentSession };
      if (!r.ok || !p.session) { set_error(p.message ?? "Unable to refresh session."); return; }
      set_session(p.session);
    } catch {
      set_error("Network error. Please check your connection.");
    }
  }

  function start_assessment() {
    start_transition(async () => {
      const r = await fetch(`/api/assessment/${token}/start`, {
        body: JSON.stringify({ runtime_metadata: get_runtime_metadata() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const p = (await r.json()) as { message?: string; session?: AssessmentSession };
      if (!r.ok || !p.session) { set_error(p.message ?? "Unable to start."); return; }
      set_error(""); set_session(p.session);
    });
  }

  function accept_consent() {
    start_transition(async () => {
      const r = await fetch(`/api/assessment/${token}/consent`, {
        body: JSON.stringify({ consent_text: session.organization.consent_text }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const p = (await r.json()) as { message?: string; session?: AssessmentSession };
      if (!r.ok || !p.session) { set_error(p.message ?? "Unable to record consent."); return; }
      set_error(""); set_session(p.session);
    });
  }

  function submit_standard_response(value: unknown) {
    if (!current_section || !current_item) return;
    start_transition(async () => {
      const r = await fetch(`/api/assessment/${token}/response`, {
        body: JSON.stringify({
          item_id: current_item.id,
          response_time_seconds: Math.max(1, Math.round((Date.now() - item_started_at_ref.current) / 1000)),
          response_value: value,
          runtime_metadata: get_runtime_metadata(),
          section_id: current_section.id,
          sequence_number: next_sequence_number,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const p = (await r.json()) as { message?: string; session?: AssessmentSession };
      if (!r.ok || !p.session) { set_error(p.message ?? "Unable to save response."); return; }
      set_error(""); set_triad_draft({ item_id: null, selection: { least: null, most: null } }); set_session(p.session);
      if (all_sections_complete(p.session)) await complete_assessment();
    });
  }

  function submit_triad_response() {
    if (!triad_selection.most || !triad_selection.least || triad_selection.most === triad_selection.least) {
      set_error("Choose one statement for Most Like Me and a different one for Least Like Me."); return;
    }
    submit_standard_response(triad_selection);
  }

  function submit_qsort() {
    if (!current_section) return;
    const distribution = (current_section.runtime_config_snapshot?.q_sort_distribution as Record<string, number> | undefined) ?? {
      "Important": 6, "Least Important": 4, "Most Important": 4, "Somewhat Important": 6,
    };
    const counts = Object.values(qsort_assignments).reduce<Record<string, number>>((a, b) => { a[b] = (a[b] ?? 0) + 1; return a; }, {});
    const all_assigned = current_section.items.every((item) => Boolean(qsort_assignments[item.id]));
    const valid = Object.entries(distribution).every(([b, e]) => (counts[b] ?? 0) === e);
    if (!all_assigned || !valid) { set_error("Assign every statement and match the required distribution."); return; }
    start_transition(async () => {
      let seq = next_sequence_number;
      for (const item of current_section.items) {
        await fetch(`/api/assessment/${token}/response`, {
          body: JSON.stringify({
            item_id: item.id,
            response_time_seconds: Math.max(1, Math.round((Date.now() - item_started_at_ref.current) / 1000)),
            response_value: qsort_assignments[item.id],
            runtime_metadata: get_runtime_metadata(),
            section_id: current_section.id,
            sequence_number: seq,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        seq += 1;
      }
      set_qsort_draft({ assignments: {}, section_id: null }); await refresh_session();
    });
  }

  async function complete_assessment() {
    const r = await fetch(`/api/assessment/${token}/complete`, { method: "POST" });
    const p = (await r.json()) as { message?: string; session?: AssessmentSession };
    if (!r.ok || !p.session) { set_error(p.message ?? "Unable to complete."); return; }
    set_session(p.session);
  }

  // ── Stages ──

  if (session.stage === "landing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-grey px-5 py-10">
        <div className="w-full max-w-lg">
          <Card>
            <CardHeader>
              <Badge tone="red">Assessment</Badge>
              <CardTitle className="mt-2 text-2xl tracking-tight">{session.campaign.name}</CardTitle>
              <CardDescription>
                {session.organization.name} &middot; {session.campaign.role_family}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 text-[13px] text-brand-black/60">
                <div className="flex justify-between rounded-xl bg-brand-grey px-4 py-3">
                  <span>Candidate</span>
                  <span className="font-medium text-brand-black">{session.candidate.name}</span>
                </div>
                <div className="flex justify-between rounded-xl bg-brand-grey px-4 py-3">
                  <span>Estimated time</span>
                  <span className="font-medium text-brand-black">80 minutes max</span>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-brand-black/40">
                This assessment covers cognitive, personality, motivator, execution, leadership, and situational judgment.
                Your responses are saved automatically.
              </p>
              {error ? <ErrorMessage message={error} /> : null}
              <Button className="w-full" disabled={is_pending} onClick={start_assessment} size="lg">
                {is_pending ? "Preparing..." : "Begin assessment"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (session.stage === "consent") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-grey px-5 py-10">
        <div className="w-full max-w-lg">
          <Card>
            <CardHeader>
              <Badge tone="neutral">Consent required</Badge>
              <CardTitle className="mt-2 text-xl tracking-tight">Data usage consent</CardTitle>
              <CardDescription>You must accept before the assessment begins.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl bg-brand-grey p-4 text-[13px] leading-relaxed text-brand-black/65">
                {session.organization.consent_text}
              </div>
              {error ? <ErrorMessage message={error} /> : null}
              <Button className="w-full" disabled={is_pending} onClick={accept_consent} size="lg">
                {is_pending ? "Saving..." : "I agree and continue"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (session.stage === "complete") {
    const invalidated = session.assessment?.status === "INVALIDATED";
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-grey px-5 py-10">
        <div className="w-full max-w-lg">
          <Card>
            <CardHeader>
              <Badge tone={invalidated ? "red" : "success"}>
                {invalidated ? "Under review" : "Complete"}
              </Badge>
              <CardTitle className="mt-2 text-2xl tracking-tight">
                {invalidated ? "Submitted for review" : "Thank you"}
              </CardTitle>
              <CardDescription>
                {invalidated
                  ? "Response quality flags were triggered. HR will review before scoring."
                  : "Your responses have been captured. HR will share next steps after review."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-[13px] text-brand-black/60">
                <div className="flex justify-between rounded-xl bg-brand-grey px-4 py-3">
                  <span>Organisation</span>
                  <span className="font-medium text-brand-black">{session.organization.name}</span>
                </div>
                <div className="flex justify-between rounded-xl bg-brand-grey px-4 py-3">
                  <span>Campaign</span>
                  <span className="font-medium text-brand-black">{session.campaign.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!current_section) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-grey px-5">
        <p className="text-[14px] text-brand-black/50">Finalising your assessment...</p>
      </div>
    );
  }

  if (pending_break) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-grey px-5 py-10">
        <div className="w-full max-w-lg">
          <Card>
            <CardHeader>
              <Badge tone="neutral">Break</Badge>
              <CardTitle className="mt-2 text-xl tracking-tight">Take a moment</CardTitle>
              <CardDescription>
                The {pending_break.layer_name} section is complete. Your responses have been saved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[13px] leading-relaxed text-brand-black/50">
                Continue when ready. You can close and reopen this link to return here.
              </p>
              <Button onClick={() => set_dismissed_break_after_section_id(pending_break.id)}>
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Assessment in progress ──

  const completed_sections = session.assessment?.sections.filter((s) => s.responses.length >= s.items.length).length ?? 0;
  const total_sections = session.assessment?.sections.length ?? 0;
  const section_progress = current_section.items.length
    ? Math.round((current_section.responses.length / current_section.items.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-brand-grey px-5 py-6">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Progress bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[12px] text-brand-black/45">
            <span>{current_section.layer_name}</span>
            <span>Section {completed_sections + 1} of {total_sections}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-brand-black/[0.06]">
            <div
              className="h-full rounded-full bg-brand-black transition-all duration-500 ease-out"
              style={{ width: `${section_progress}%` }}
            />
          </div>
          <p className="text-[11px] text-brand-black/35">
            Question {current_section.responses.length + 1} of {current_section.items.length}
          </p>
        </div>

        {current_section.layer_code === "MOTIVATORS" ? (
          <QSortSection
            assignments={qsort_assignments}
            error={error}
            is_pending={is_pending}
            onAssign={(item_id, bucket) =>
              set_qsort_draft({ assignments: { ...qsort_assignments, [item_id]: bucket }, section_id: current_section.id })
            }
            onDragStart={set_dragging_option}
            onSubmit={submit_qsort}
            runtime_config={current_section.runtime_config_snapshot ?? {}}
            section={current_section}
          />
        ) : current_item ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-[17px] leading-relaxed tracking-tight">{current_item.stem}</CardTitle>
              {current_item.time_limit_seconds ? (
                <CardDescription>{current_item.time_limit_seconds}s target</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {current_item.item_type === "FORCED_CHOICE_TRIAD" ? (
                <ForcedChoiceTriad
                  dragging_option={dragging_option}
                  error={error}
                  is_pending={is_pending}
                  item={current_item}
                  onDragStart={set_dragging_option}
                  onDropSelection={(slot, value) =>
                    set_triad_draft({ item_id: current_item.id, selection: { ...triad_selection, [slot]: value } })
                  }
                  onSubmit={submit_triad_response}
                  selection={triad_selection}
                />
              ) : current_item.item_type === "LIKERT" ? (
                <div className="grid gap-2 sm:grid-cols-5">
                  {current_item.options.map((option, i) => (
                    <button
                      className="rounded-xl border border-brand-black/[0.08] bg-brand-white px-3 py-4 text-center text-[13px] font-medium transition-all duration-150 hover:border-brand-black/20 hover:shadow-sm active:scale-[0.97]"
                      disabled={is_pending}
                      key={`${current_item.id}-${i}`}
                      onClick={() => submit_standard_response(Number(option.score_weight ?? i + 1))}
                      type="button"
                    >
                      {String(option.option_text)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid gap-2">
                  {current_item.options.map((option, i) => (
                    <button
                      className="rounded-xl border border-brand-black/[0.08] bg-brand-white px-4 py-3.5 text-left text-[13px] font-medium transition-all duration-150 hover:border-brand-black/20 hover:shadow-sm active:scale-[0.99]"
                      disabled={is_pending}
                      key={`${current_item.id}-${i}`}
                      onClick={() => submit_standard_response(option.option_text ?? option.label ?? option.id ?? option)}
                      type="button"
                    >
                      {String(option.option_text ?? option.label ?? option)}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-brand-red">{message}</div>
  );
}

function ForcedChoiceTriad({
  dragging_option,
  error,
  is_pending,
  item,
  onDragStart,
  onDropSelection,
  onSubmit,
  selection,
}: {
  dragging_option: string | null;
  error: string;
  is_pending: boolean;
  item: AssessmentPublicItem;
  onDragStart: (value: string | null) => void;
  onDropSelection: (slot: "least" | "most", value: string) => void;
  onSubmit: () => void;
  selection: { least: string | null; most: string | null };
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {item.options.map((option, i) => (
          <div
            className="cursor-move rounded-xl border border-brand-black/[0.08] bg-brand-grey px-4 py-3.5 transition-colors hover:bg-brand-grey-dark"
            draggable
            key={`${item.id}-triad-${i}`}
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(option.option_text ?? "")); onDragStart(String(option.option_text ?? "")); }}
          >
            <p className="text-[13px] leading-relaxed text-brand-black/75">{String(option.option_text)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { label: "Most Like Me", slot: "most" as const, value: selection.most },
          { label: "Least Like Me", slot: "least" as const, value: selection.least },
        ]).map((slot) => (
          <div
            className="min-h-24 rounded-xl border-2 border-dashed border-brand-black/[0.12] bg-brand-black/[0.02] p-4 transition-colors"
            key={slot.slot}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragging_option) { onDropSelection(slot.slot, dragging_option); onDragStart(null); } }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-black/35">{slot.label}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-brand-black/65">
              {slot.value ?? "Drag a statement here"}
            </p>
          </div>
        ))}
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      <Button disabled={is_pending} onClick={onSubmit}>Save and continue</Button>
    </div>
  );
}

function QSortSection({
  assignments,
  error,
  is_pending,
  onAssign,
  onDragStart,
  onSubmit,
  runtime_config,
  section,
}: {
  assignments: Record<string, string>;
  error: string;
  is_pending: boolean;
  onAssign: (item_id: string, bucket: string) => void;
  onDragStart: (value: string | null) => void;
  onSubmit: () => void;
  runtime_config: Record<string, unknown>;
  section: AssessmentSessionSection;
}) {
  const distribution = (runtime_config.q_sort_distribution as Record<string, number> | undefined) ?? {
    "Important": 6, "Least Important": 4, "Most Important": 4, "Somewhat Important": 6,
  };

  return (
    <Card>
      <CardHeader>
        <Badge tone="neutral">{section.layer_name}</Badge>
        <CardTitle className="mt-2 text-[17px] tracking-tight">Sort each statement into a category</CardTitle>
        <CardDescription>Match the required distribution before continuing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          {section.items
            .filter((item: AssessmentPublicItem) => !assignments[item.id])
            .map((item: AssessmentPublicItem) => (
              <div
                className="cursor-move rounded-xl border border-brand-black/[0.08] bg-brand-grey px-4 py-3 transition-colors hover:bg-brand-grey-dark"
                draggable
                key={item.id}
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); onDragStart(item.id); }}
              >
                <p className="text-[13px] leading-relaxed text-brand-black/70">{item.stem}</p>
              </div>
            ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(distribution).map(([bucket, expected]) => (
            <div
              className="min-h-32 rounded-xl border-2 border-dashed border-brand-black/[0.12] bg-brand-black/[0.02] p-4"
              key={bucket}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) onAssign(id, bucket); }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-black/35">
                {bucket} ({Object.values(assignments).filter((v) => v === bucket).length}/{expected})
              </p>
              <div className="mt-2 space-y-2">
                {section.items
                  .filter((item: AssessmentPublicItem) => assignments[item.id] === bucket)
                  .map((item: AssessmentPublicItem) => (
                    <div
                      className="cursor-move rounded-lg bg-brand-white px-3 py-2.5 text-[12px] leading-relaxed text-brand-black/65 shadow-sm"
                      draggable
                      key={`${bucket}-${item.id}`}
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); onDragStart(item.id); }}
                    >
                      {item.stem}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {error ? <ErrorMessage message={error} /> : null}

        <Button disabled={is_pending} onClick={onSubmit}>Save motivator section</Button>
      </CardContent>
    </Card>
  );
}

function all_sections_complete(session?: AssessmentSession) {
  return Boolean(session?.assessment?.sections.every((s) => s.responses.length >= s.items.length));
}

function get_runtime_metadata() {
  return {
    browser: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    language: typeof navigator !== "undefined" ? navigator.language : "unknown",
    platform: typeof navigator !== "undefined" ? navigator.platform : "unknown",
    screen: typeof window !== "undefined" ? { height: window.innerHeight, width: window.innerWidth } : null,
  };
}
