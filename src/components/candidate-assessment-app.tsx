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
    if (!session.assessment || !current_section) {
      return null;
    }

    const current_index = session.assessment.sections.findIndex((section) => section.id === current_section.id);

    if (current_index <= 0) {
      return null;
    }

    const previous_section = session.assessment.sections[current_index - 1];

    if (!previous_section) {
      return null;
    }

    const completed_previous_section = previous_section.responses.length >= previous_section.items.length;
    const break_after_previous_section = previous_section.runtime_config_snapshot?.break_after === true;

    if (!completed_previous_section || !break_after_previous_section || dismissed_break_after_section_id === previous_section.id) {
      return null;
    }

    return previous_section;
  }, [current_section, dismissed_break_after_section_id, session.assessment]);
  const triad_selection = useMemo(() => {
    if (!current_item || current_item.item_type !== "FORCED_CHOICE_TRIAD") {
      return { least: null, most: null };
    }

    if (triad_draft.item_id === current_item.id) {
      return triad_draft.selection;
    }

    const existing_response = current_section?.responses.find((response) => response.item_id === current_item.id);

    if (
      existing_response &&
      existing_response.response_value &&
      typeof existing_response.response_value === "object" &&
      "least" in (existing_response.response_value as Record<string, unknown>) &&
      "most" in (existing_response.response_value as Record<string, unknown>)
    ) {
      const value = existing_response.response_value as Record<string, unknown>;

      return {
        least: typeof value.least === "string" ? value.least : null,
        most: typeof value.most === "string" ? value.most : null,
      };
    }

    return { least: null, most: null };
  }, [current_item, current_section?.responses, triad_draft]);
  const qsort_assignments = useMemo(() => {
    if (current_section?.layer_code !== "MOTIVATORS") {
      return {};
    }

    if (qsort_draft.section_id === current_section.id) {
      return qsort_draft.assignments;
    }

    return Object.fromEntries(current_section.responses.map((response) => [response.item_id, String(response.response_value)]));
  }, [current_section, qsort_draft]);

  const heartbeat = useEffectEvent(async () => {
    if (session.stage !== "assessment" || !session.assessment) {
      return;
    }

    await fetch(`/api/assessment/${token}/heartbeat`, {
      body: JSON.stringify({
        runtime_metadata: get_runtime_metadata(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  useEffect(() => {
    if (session.stage !== "assessment") {
      return;
    }

    const interval_id = window.setInterval(() => {
      void heartbeat();
    }, 30_000);

    return () => window.clearInterval(interval_id);
  }, [session.stage]);

  useEffect(() => {
    item_started_at_ref.current = Date.now();
  }, [current_item?.id, current_section?.id]);

  async function refresh_session() {
    const response = await fetch(`/api/assessment/${token}`);
    const payload = (await response.json()) as { message?: string; session?: AssessmentSession };

    if (!response.ok || !payload.session) {
      set_error(payload.message ?? "Unable to refresh the assessment session.");
      return;
    }

    set_session(payload.session);
  }

  function start_assessment() {
    start_transition(async () => {
      const response = await fetch(`/api/assessment/${token}/start`, {
        body: JSON.stringify({
          runtime_metadata: get_runtime_metadata(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as { message?: string; session?: AssessmentSession };

      if (!response.ok || !payload.session) {
        set_error(payload.message ?? "Unable to start the assessment.");
        return;
      }

      set_error("");
      set_session(payload.session);
    });
  }

  function accept_consent() {
    start_transition(async () => {
      const response = await fetch(`/api/assessment/${token}/consent`, {
        body: JSON.stringify({
          consent_text: session.organization.consent_text,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as { message?: string; session?: AssessmentSession };

      if (!response.ok || !payload.session) {
        set_error(payload.message ?? "Unable to record consent.");
        return;
      }

      set_error("");
      set_session(payload.session);
    });
  }

  function submit_standard_response(value: unknown) {
    if (!current_section || !current_item) {
      return;
    }

    start_transition(async () => {
      const response = await fetch(`/api/assessment/${token}/response`, {
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

      const payload = (await response.json()) as { message?: string; session?: AssessmentSession };

      if (!response.ok || !payload.session) {
        set_error(payload.message ?? "Unable to save response.");
        return;
      }

      set_error("");
      set_triad_draft({ item_id: null, selection: { least: null, most: null } });
      set_session(payload.session);

      if (all_sections_complete(payload.session)) {
        await complete_assessment();
      }
    });
  }

  function submit_triad_response() {
    if (!triad_selection.most || !triad_selection.least || triad_selection.most === triad_selection.least) {
      set_error("Choose one statement for Most Like Me and a different statement for Least Like Me.");
      return;
    }

    submit_standard_response(triad_selection);
  }

  function submit_qsort() {
    if (!current_section) {
      return;
    }

    const distribution = (current_section.runtime_config_snapshot?.q_sort_distribution as Record<string, number> | undefined) ?? {
      "Important": 6,
      "Least Important": 4,
      "Most Important": 4,
      "Somewhat Important": 6,
    };

    const counts = Object.entries(qsort_assignments).reduce<Record<string, number>>((accumulator, [, bucket]) => {
      accumulator[bucket] = (accumulator[bucket] ?? 0) + 1;
      return accumulator;
    }, {});

    const all_assigned = current_section.items.every((item) => Boolean(qsort_assignments[item.id]));
    const valid_distribution = Object.entries(distribution).every(([bucket, expected]) => (counts[bucket] ?? 0) === expected);

    if (!all_assigned || !valid_distribution) {
      set_error("Assign every statement and match the required bucket distribution before continuing.");
      return;
    }

    start_transition(async () => {
      let sequence = next_sequence_number;

      for (const item of current_section.items) {
        await fetch(`/api/assessment/${token}/response`, {
          body: JSON.stringify({
            item_id: item.id,
            response_time_seconds: Math.max(1, Math.round((Date.now() - item_started_at_ref.current) / 1000)),
            response_value: qsort_assignments[item.id],
            runtime_metadata: get_runtime_metadata(),
            section_id: current_section.id,
            sequence_number: sequence,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        sequence += 1;
      }

      set_qsort_draft({ assignments: {}, section_id: null });
      await refresh_session();
    });
  }

  async function complete_assessment() {
    const response = await fetch(`/api/assessment/${token}/complete`, {
      method: "POST",
    });
    const payload = (await response.json()) as { message?: string; session?: AssessmentSession };

    if (!response.ok || !payload.session) {
      set_error(payload.message ?? "Unable to complete the assessment.");
      return;
    }

    set_session(payload.session);
  }

  if (session.stage === "landing") {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-6">
        <Card>
          <CardHeader>
            <Badge tone="red">Assessment invite</Badge>
            <CardTitle className="mt-3 text-4xl">{session.campaign.name}</CardTitle>
            <CardDescription>
              {session.organization.name} psychometric assessment for the {session.campaign.role_family} role family.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 text-sm leading-7 text-brand-black/75">
              <p>Candidate: {session.candidate.name}</p>
              <p>Version: {session.campaign.version_label}</p>
              <p>Estimated time: 80 minutes maximum</p>
              <p>Result timeline: communicated by HR after review and scoring completion.</p>
            </div>
            <div className="space-y-4 rounded-[1.5rem] bg-brand-grey p-5">
              <p className="text-sm leading-7 text-brand-black/75">
                This assessment combines cognitive, personality, motivator, execution, leadership, and situational judgment layers. Your
                responses are auto-saved and you can resume through the same link if needed.
              </p>
              {error ? <p className="text-sm text-brand-red">{error}</p> : null}
              <Button disabled={is_pending} onClick={start_assessment} type="button">
                {is_pending ? "Preparing..." : "Begin assessment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.stage === "consent") {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-6">
        <Card>
          <CardHeader>
            <Badge tone="red">Consent required</Badge>
            <CardTitle className="mt-3 text-4xl">Data usage and assessment consent</CardTitle>
            <CardDescription>You must accept the consent statement before the assessment begins.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-[1.5rem] bg-brand-grey p-5 text-sm leading-7 text-brand-black/80">{session.organization.consent_text}</div>
            {error ? <p className="text-sm text-brand-red">{error}</p> : null}
            <Button disabled={is_pending} onClick={accept_consent} type="button">
              {is_pending ? "Saving..." : "I agree and continue"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.stage === "complete") {
    const invalidated = session.assessment?.status === "INVALIDATED";

    return (
      <div className="mx-auto max-w-4xl space-y-6 py-6">
        <Card>
          <CardHeader>
            <Badge tone={invalidated ? "red" : "success"}>{invalidated ? "Assessment invalidated" : "Assessment complete"}</Badge>
            <CardTitle className="mt-3 text-4xl">{invalidated ? "Assessment submitted for review" : "Thank you for completing the assessment"}</CardTitle>
            <CardDescription>
              {invalidated
                ? "Response-quality flags were triggered, so HR will review the attempt before any scoring proceeds."
                : "Your responses have been captured successfully. HR will share next steps after scoring and review."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-brand-black/75">
            <p>Organisation: {session.organization.name}</p>
            <p>Campaign: {session.campaign.name}</p>
            <p>Role family: {session.campaign.role_family}</p>
            <p>Quality flags captured: {session.assessment?.quality_flags.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!current_section) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-lg">All sections are answered. Finalising your assessment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pending_break) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-6">
        <Card>
          <CardHeader>
            <Badge tone="red">Optional break</Badge>
            <CardTitle className="mt-3 text-4xl">You can pause briefly before the next section</CardTitle>
            <CardDescription>
              The {pending_break.layer_name} section is complete and your responses have already been saved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-7 text-brand-black/75">
              Continue when you are ready. Reopening the same invite link will bring you back to this point if you leave now.
            </p>
            <Button onClick={() => set_dismissed_break_after_section_id(pending_break.id)} type="button">
              Continue assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completed_sections = session.assessment?.sections.filter((section) => section.responses.length >= section.items.length).length ?? 0;
  const total_sections = session.assessment?.sections.length ?? 0;
  const section_progress = current_section.items.length
    ? Math.round((current_section.responses.length / current_section.items.length) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <Card>
        <CardContent className="grid gap-4 py-6 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-black/55">Overall progress</p>
            <p className="mt-2 text-3xl font-semibold">
              {completed_sections}/{total_sections} sections
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-black/55">Current section</p>
            <p className="mt-2 text-3xl font-semibold">{current_section.layer_name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-black/55">Section progress</p>
            <p className="mt-2 text-3xl font-semibold">{section_progress}%</p>
          </div>
        </CardContent>
      </Card>

      {current_section.layer_code === "MOTIVATORS" ? (
        <QSortSection
          assignments={qsort_assignments}
          error={error}
          onAssign={(item_id, bucket) =>
            set_qsort_draft({
              assignments: {
                ...qsort_assignments,
                [item_id]: bucket,
              },
              section_id: current_section.id,
            })
          }
          onDragStart={set_dragging_option}
          onSubmit={submit_qsort}
          runtime_config={current_section.runtime_config_snapshot ?? {}}
          section={current_section}
        />
      ) : current_item ? (
        <Card>
          <CardHeader>
            <Badge tone="red">{current_section.layer_name}</Badge>
            <CardTitle className="mt-3 text-3xl">{current_item.stem}</CardTitle>
            <CardDescription>
              Item {current_section.responses.length + 1} of {current_section.items.length}
              {current_item.time_limit_seconds ? ` • ${current_item.time_limit_seconds} second target` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {current_item.item_type === "FORCED_CHOICE_TRIAD" ? (
              <ForcedChoiceTriad
                dragging_option={dragging_option}
                error={error}
                item={current_item}
                onDragStart={set_dragging_option}
                onDropSelection={(slot, value) =>
                  set_triad_draft({
                    item_id: current_item.id,
                    selection: {
                      ...triad_selection,
                      [slot]: value,
                    },
                  })
                }
                onSubmit={submit_triad_response}
                selection={triad_selection}
              />
            ) : current_item.item_type === "LIKERT" ? (
              <div className="grid gap-3 sm:grid-cols-5">
                {current_item.options.map((option, index) => (
                  <button
                    className="rounded-[1.4rem] border border-brand-black/12 bg-brand-grey px-4 py-5 text-left transition hover:border-brand-red"
                    key={`${current_item.id}-${index}`}
                    onClick={() => submit_standard_response(Number(option.score_weight ?? index + 1))}
                    type="button"
                  >
                    <p className="text-sm font-semibold">{String(option.option_text)}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid gap-3">
                {current_item.options.map((option, index) => (
                  <button
                    className="rounded-[1.4rem] border border-brand-black/12 bg-brand-grey px-4 py-5 text-left transition hover:border-brand-red"
                    key={`${current_item.id}-${index}`}
                    onClick={() => submit_standard_response(option.option_text ?? option.label ?? option.id ?? option)}
                    type="button"
                  >
                    <p className="text-sm font-semibold">{String(option.option_text ?? option.label ?? option)}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ForcedChoiceTriad({
  dragging_option,
  error,
  item,
  onDragStart,
  onDropSelection,
  onSubmit,
  selection,
}: {
  dragging_option: string | null;
  error: string;
  item: AssessmentPublicItem;
  onDragStart: (value: string | null) => void;
  onDropSelection: (slot: "least" | "most", value: string) => void;
  onSubmit: () => void;
  selection: { least: string | null; most: string | null };
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        {item.options.map((option, index: number) => (
          <div
            className="cursor-move rounded-[1.5rem] border border-brand-black/12 bg-brand-grey px-4 py-5"
            draggable
            key={`${item.id}-triad-${index}`}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", String(option.option_text ?? ""));
              onDragStart(String(option.option_text ?? ""));
            }}
          >
            <p className="text-sm leading-7 text-brand-black/80">{String(option.option_text)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: "Most Like Me", slot: "most" as const, value: selection.most },
          { label: "Least Like Me", slot: "least" as const, value: selection.least },
        ].map((slot) => (
          <div
            className="min-h-32 rounded-[1.5rem] border-2 border-dashed border-brand-red/35 bg-brand-red/8 p-5"
            key={slot.slot}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragging_option) {
                onDropSelection(slot.slot, dragging_option);
                onDragStart(null);
              }
            }}
          >
            <p className="text-sm font-semibold text-brand-red">{slot.label}</p>
            <p className="mt-3 text-sm leading-7 text-brand-black/80">{slot.value ?? "Drag a statement here"}</p>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}

      <Button onClick={onSubmit} type="button">
        Save and continue
      </Button>
    </div>
  );
}

function QSortSection({
  assignments,
  error,
  onAssign,
  onDragStart,
  onSubmit,
  runtime_config,
  section,
}: {
  assignments: Record<string, string>;
  error: string;
  onAssign: (item_id: string, bucket: string) => void;
  onDragStart: (value: string | null) => void;
  onSubmit: () => void;
  runtime_config: Record<string, unknown>;
  section: AssessmentSessionSection;
}) {
  const distribution = (runtime_config.q_sort_distribution as Record<string, number> | undefined) ?? {
    "Important": 6,
    "Least Important": 4,
    "Most Important": 4,
    "Somewhat Important": 6,
  };

  return (
    <Card>
      <CardHeader>
        <Badge tone="red">{section.layer_name}</Badge>
        <CardTitle className="mt-3 text-3xl">Drag each statement into the bucket that fits best</CardTitle>
        <CardDescription>Follow the forced distribution exactly before continuing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3">
          {section.items
            .filter((item: AssessmentPublicItem) => !assignments[item.id])
            .map((item: AssessmentPublicItem) => (
              <div
                className="cursor-move rounded-[1.5rem] border border-brand-black/12 bg-brand-grey px-4 py-4"
                draggable
                key={item.id}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", item.id);
                  onDragStart(item.id);
                }}
              >
                <p className="text-sm leading-7 text-brand-black/80">{item.stem}</p>
              </div>
            ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(distribution).map(([bucket, expected]) => (
            <div
              className="min-h-40 rounded-[1.5rem] border-2 border-dashed border-brand-red/35 bg-brand-red/8 p-5"
              key={bucket}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dragged = event.dataTransfer.getData("text/plain");
                const item_id = dragged || "";
                if (item_id) {
                  onAssign(item_id, bucket);
                }
              }}
            >
              <p className="text-sm font-semibold text-brand-red">
                {bucket} ({Object.values(assignments).filter((value) => value === bucket).length}/{expected})
              </p>
              <div className="mt-3 space-y-3">
                {section.items
                  .filter((item: AssessmentPublicItem) => assignments[item.id] === bucket)
                  .map((item: AssessmentPublicItem) => (
                    <div
                      className="rounded-[1rem] bg-brand-white px-3 py-3 text-sm leading-6 text-brand-black/80"
                      draggable
                      key={`${bucket}-${item.id}`}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", item.id);
                        onDragStart(item.id);
                      }}
                    >
                      {item.stem}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {error ? <p className="text-sm text-brand-red">{error}</p> : null}

        <Button onClick={onSubmit} type="button">
          Save motivator section
        </Button>
      </CardContent>
    </Card>
  );
}

function all_sections_complete(session?: AssessmentSession) {
  return Boolean(session?.assessment?.sections.every((section) => section.responses.length >= section.items.length));
}

function get_runtime_metadata() {
  return {
    browser: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    language: typeof navigator !== "undefined" ? navigator.language : "unknown",
    platform: typeof navigator !== "undefined" ? navigator.platform : "unknown",
    screen:
      typeof window !== "undefined"
        ? {
            height: window.innerHeight,
            width: window.innerWidth,
          }
        : null,
  };
}
