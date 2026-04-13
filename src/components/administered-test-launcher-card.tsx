"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdministeredTestDto } from "@/lib/administered-tests";

type RoleFamilyOption = {
  id: string;
  name: string;
};

type VersionOption = {
  id: string;
  version_label: string;
};

export function AdministeredTestLauncherCard({
  description,
  role_families,
  title,
  versions,
}: {
  description: string;
  role_families: RoleFamilyOption[];
  title: string;
  versions: VersionOption[];
}) {
  const [form, set_form] = useState({
    assessment_version_id: versions[0]?.id ?? "",
    candidate_email: "",
    candidate_name: "",
    expires_in_days: 14,
    role_family_id: role_families[0]?.id ?? "",
  });
  const [generated_link, set_generated_link] = useState<AdministeredTestDto | null>(null);
  const [message, set_message] = useState<string | null>(null);
  const [is_pending, start_transition] = useTransition();

  function generate_link() {
    set_message(null);

    if (!form.candidate_name.trim() || !form.candidate_email.trim()) {
      set_message("Please fill in the candidate name and email.");
      return;
    }

    if (!form.role_family_id || !form.assessment_version_id) {
      set_message("Please select a role family and assessment version.");
      return;
    }

    start_transition(async () => {
      const response = await fetch("/api/admin/administered-tests", {
        body: JSON.stringify(form),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { administered_test?: AdministeredTestDto; message?: string };
      set_message(payload.message ?? null);

      if (response.ok && payload.administered_test) {
        set_generated_link(payload.administered_test);
        set_form((current) => ({
          ...current,
          candidate_email: "",
          candidate_name: "",
        }));
      }
    });
  }

  async function copy_link() {
    if (!generated_link) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generated_link.assessment_link);
      set_message("Assessment link copied to the clipboard.");
    } catch {
      set_message("Copy failed. Open the link directly and copy it from the browser.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-black/60">Candidate name</span>
            <input
              className="w-full rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
              onChange={(event) => set_form((current) => ({ ...current, candidate_name: event.target.value }))}
              placeholder="e.g. Priya Sharma"
              required
              value={form.candidate_name}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-black/60">Candidate email</span>
            <input
              className="w-full rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
              onChange={(event) => set_form((current) => ({ ...current, candidate_email: event.target.value }))}
              placeholder="e.g. priya@example.com"
              required
              type="email"
              value={form.candidate_email}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-black/60">Role family</span>
            <select
              className="w-full rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
              onChange={(event) => set_form((current) => ({ ...current, role_family_id: event.target.value }))}
              value={form.role_family_id}
            >
              {role_families.map((role_family) => (
                <option key={role_family.id} value={role_family.id}>
                  {role_family.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-black/60">Assessment version</span>
            <select
              className="w-full rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
              onChange={(event) => set_form((current) => ({ ...current, assessment_version_id: event.target.value }))}
              value={form.assessment_version_id}
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.version_label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-[0.5fr_1.5fr]">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-black/60">Expires in (days)</span>
            <input
              className="w-full rounded-[1.2rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
              min={1}
              max={30}
              onChange={(event) => set_form((current) => ({ ...current, expires_in_days: Number(event.target.value) }))}
              type="number"
              value={form.expires_in_days}
            />
          </label>
          <div className="flex items-end">
            <div className="rounded-[1.2rem] border border-brand-black/10 bg-brand-grey px-4 py-3 text-sm leading-6 text-brand-black/74">
              Generate a shareable link, send it to the candidate, and keep every response, assessment record, and result inside this app.
            </div>
          </div>
        </div>

        {message ? (
          <p className={`rounded-[1rem] px-4 py-3 text-sm ${generated_link ? "bg-brand-grey text-brand-black/75" : "bg-brand-red/10 text-brand-red"}`}>
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button disabled={is_pending} onClick={generate_link} type="button">
            {is_pending ? "Generating..." : "Generate test link"}
          </Button>
          {generated_link ? (
            <>
              <Button onClick={copy_link} type="button" variant="outline">
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

        {generated_link ? (
          <div className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-brand-black/55">Latest generated link</p>
            <p className="mt-2 overflow-x-auto whitespace-nowrap text-sm font-semibold text-brand-black">{generated_link.assessment_link}</p>
            <p className="mt-3 text-sm text-brand-black/70">
              {generated_link.candidate_name} · {generated_link.role_family_name} · {generated_link.status}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
