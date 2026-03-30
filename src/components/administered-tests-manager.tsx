"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdministeredTestDto } from "@/lib/administered-tests";
import { format_date } from "@/lib/utils";

type RoleFamilyOption = {
  id: string;
  name: string;
};

type VersionOption = {
  id: string;
  version_label: string;
};

type FormState = {
  assessment_version_id: string;
  candidate_email: string;
  candidate_name: string;
  expires_in_days: number;
  role_family_id: string;
};

export function AdministeredTestsManager({
  initial_administered_tests,
  role_families,
  versions,
}: {
  initial_administered_tests: AdministeredTestDto[];
  role_families: RoleFamilyOption[];
  versions: VersionOption[];
}) {
  const [administered_tests, set_administered_tests] = useState(initial_administered_tests);
  const [message, set_message] = useState("");
  const [generated_link, set_generated_link] = useState<AdministeredTestDto | null>(initial_administered_tests[0] ?? null);
  const [is_pending, start_transition] = useTransition();
  const [form, set_form] = useState<FormState>({
    assessment_version_id: versions[0]?.id ?? "",
    candidate_email: "",
    candidate_name: "",
    expires_in_days: 14,
    role_family_id: role_families[0]?.id ?? "",
  });

  const metrics = useMemo(() => {
    return {
      completed: administered_tests.filter((entry) => entry.status === "COMPLETED").length,
      live: administered_tests.filter((entry) => entry.status === "SENT" || entry.status === "STARTED" || entry.status === "IN_PROGRESS").length,
      total: administered_tests.length,
    };
  }, [administered_tests]);

  function create_link() {
    set_message("");

    start_transition(async () => {
      const response = await fetch("/api/admin/administered-tests", {
        body: JSON.stringify(form),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as { administered_test?: AdministeredTestDto; message?: string };

      if (!response.ok || !payload.administered_test) {
        set_message(payload.message ?? "Unable to generate the administered test link.");
        return;
      }

      set_generated_link(payload.administered_test);
      set_administered_tests((current) => [payload.administered_test!, ...current]);
      set_message(payload.message ?? "Administered test link generated.");
      set_form((current) => ({
        ...current,
        candidate_email: "",
        candidate_name: "",
      }));
    });
  }

  async function copy_link(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      set_message("Assessment link copied to the clipboard.");
    } catch {
      set_message("Copy failed. Open the link directly and copy it from the browser.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Badge tone="red">Smooth launch flow</Badge>
            <CardTitle className="mt-3">Administered test link generator</CardTitle>
            <CardDescription>
              Create a candidate link in one step. The assessment results stay inside this platform through the existing invite, session, and scoring flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/12 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, candidate_name: event.target.value }))}
                placeholder="Candidate name"
                value={form.candidate_name}
              />
              <input
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/12 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, candidate_email: event.target.value }))}
                placeholder="Candidate email"
                type="email"
                value={form.candidate_email}
              />
              <select
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/12 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, role_family_id: event.target.value }))}
                value={form.role_family_id}
              >
                {role_families.map((role_family) => (
                  <option key={role_family.id} value={role_family.id}>
                    {role_family.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/12 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
                onChange={(event) => set_form((current) => ({ ...current, assessment_version_id: event.target.value }))}
                value={form.assessment_version_id}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version_label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
              <input
                className="w-full min-w-0 rounded-[1.2rem] border border-brand-black/12 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
                min={1}
                onChange={(event) => set_form((current) => ({ ...current, expires_in_days: Number(event.target.value) }))}
                placeholder="Expires in days"
                type="number"
                value={form.expires_in_days}
              />
              <div className="rounded-[1.25rem] border border-brand-black/8 bg-brand-grey px-4 py-3 text-sm leading-6 text-brand-black/72">
                The generated invite opens the public assessment runtime. Completion, responses, scoring, and reports remain inside the app database.
              </div>
            </div>

            {message ? <p className="rounded-[1rem] bg-brand-red/8 px-4 py-3 text-sm text-brand-red">{message}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button disabled={is_pending} onClick={create_link} type="button">
                {is_pending ? "Generating..." : "Generate test link"}
              </Button>
              {generated_link ? (
                <>
                  <Button onClick={() => copy_link(generated_link.assessment_link)} type="button" variant="outline">
                    Copy link
                  </Button>
                  <a
                    className="inline-flex items-center justify-center rounded-full border border-brand-black bg-brand-white px-4 py-2 text-sm font-semibold text-brand-black transition hover:border-brand-red hover:text-brand-red"
                    href={generated_link.assessment_link}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open test
                  </a>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest generated link</CardTitle>
            <CardDescription>Use this immediately after generating an administered test.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generated_link ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Candidate", value: generated_link.candidate_name },
                    { label: "Role family", value: generated_link.role_family_name },
                    { label: "Status", value: generated_link.status },
                  ].map((entry) => (
                    <div className="rounded-[1.2rem] bg-brand-grey px-4 py-3" key={entry.label}>
                      <p className="text-xs uppercase tracking-[0.18em] text-brand-black/55">{entry.label}</p>
                      <p className="mt-2 text-sm font-semibold text-brand-black">{entry.value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-brand-black/55">Assessment link</p>
                  <p className="mt-2 overflow-x-auto whitespace-nowrap text-sm font-semibold text-brand-black">{generated_link.assessment_link}</p>
                </div>
                {generated_link.assessment_id ? (
                  <div className="rounded-[1.2rem] bg-brand-white px-4 py-3 text-sm leading-6 text-brand-black/74">
                    Assessment record: <span className="font-semibold text-brand-black">{generated_link.assessment_id}</span>
                  </div>
                ) : null}
                <p className="text-sm leading-6 text-brand-black/70">
                  Generated {format_date(generated_link.created_at)}. Expires {format_date(generated_link.expires_at)}.
                </p>
              </>
            ) : (
              <p className="text-sm leading-6 text-brand-black/70">Generate your first administered test link to populate this workspace.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent administered tests</CardTitle>
            <CardDescription>Every generated link is tracked here, and completed results remain in the app database.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Total links", value: metrics.total },
              { label: "Live", value: metrics.live },
              { label: "Completed", value: metrics.completed },
            ].map((metric) => (
              <div className="rounded-[1.2rem] bg-brand-grey px-4 py-4" key={metric.label}>
                <p className="text-xs uppercase tracking-[0.18em] text-brand-black/55">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-brand-black">{metric.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Result tracking</CardTitle>
            <CardDescription>
              Share the link, let the candidate complete the test, and the session status will update inside the same platform data model.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {administered_tests.length ? (
              administered_tests.map((entry) => (
                <div className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey p-4" key={entry.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-brand-black">{entry.candidate_name}</p>
                      <p className="truncate text-sm text-brand-black/68">{entry.candidate_email}</p>
                    </div>
                    <Badge tone={entry.status === "COMPLETED" ? "success" : entry.status === "SENT" ? "red" : "neutral"}>{entry.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[1rem] bg-brand-white px-3 py-3 text-sm text-brand-black/74">
                      <p className="font-semibold text-brand-black">{entry.role_family_name}</p>
                      <p>{entry.assessment_version_label}</p>
                    </div>
                    <div className="rounded-[1rem] bg-brand-white px-3 py-3 text-sm text-brand-black/74">
                      <p>Created: {format_date(entry.created_at)}</p>
                      <p>Completed: {entry.completed_at ? format_date(entry.completed_at) : "Pending"}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => copy_link(entry.assessment_link)} type="button" variant="outline">
                      Copy link
                    </Button>
                    <a
                      className="inline-flex items-center justify-center rounded-full border border-brand-black bg-brand-white px-4 py-2 text-sm font-semibold text-brand-black transition hover:border-brand-red hover:text-brand-red"
                      href={entry.assessment_link}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open link
                    </a>
                    {entry.assessment_id ? (
                      <a
                        className="inline-flex items-center justify-center rounded-full border border-brand-black bg-brand-white px-4 py-2 text-sm font-semibold text-brand-black transition hover:border-brand-red hover:text-brand-red"
                        href={`/api/reports/individual/${entry.assessment_id}/pdf`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Internal report
                      </a>
                    ) : null}
                  </div>
                  {entry.assessment_id ? (
                    <p className="mt-3 overflow-x-auto whitespace-nowrap text-sm text-brand-black/62">Assessment record: {entry.assessment_id}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-brand-black/70">No administered tests have been generated yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
