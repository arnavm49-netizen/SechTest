"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdministeredTestDto } from "@/lib/administered-tests";
import type { CampaignDto } from "@/lib/campaign-types";
import { format_date } from "@/lib/utils";
import { AdministeredTestLauncherCard } from "@/components/administered-test-launcher-card";

type RoleFamilyOption = {
  id: string;
  name: string;
};

type VersionOption = {
  id: string;
  version_label: string;
};

export function AssessorWorkspace({
  campaigns,
  administered_tests: initial_tests,
  role_families,
  versions,
}: {
  administered_tests: AdministeredTestDto[];
  campaigns: CampaignDto[];
  role_families: RoleFamilyOption[];
  versions: VersionOption[];
}) {
  const [administered_tests, set_administered_tests] = useState(initial_tests);
  const [is_refreshing, set_is_refreshing] = useState(false);

  const refresh_tests = useCallback(async () => {
    set_is_refreshing(true);
    try {
      const response = await fetch("/api/admin/administered-tests", { cache: "no-store" });
      const payload = (await response.json()) as { administered_tests?: AdministeredTestDto[] };
      if (response.ok && payload.administered_tests) {
        set_administered_tests(payload.administered_tests);
      }
    } finally {
      set_is_refreshing(false);
    }
  }, []);

  const active_campaigns = campaigns.filter((campaign) => campaign.status === "ACTIVE").length;
  const live_links = administered_tests.filter((entry) => entry.status === "SENT" || entry.status === "STARTED" || entry.status === "IN_PROGRESS").length;
  const completed_links = administered_tests.filter((entry) => entry.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">Delivery workspace</Badge>
        <h1 className="text-4xl font-semibold">Assessor operations</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Launch candidate tests, monitor campaign delivery, and keep the resulting records, scoring, and reports inside the same platform.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Active campaigns" value={String(active_campaigns)} />
        <MetricCard label="Live direct links" value={String(live_links)} />
        <MetricCard label="Completed direct links" value={String(completed_links)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdministeredTestLauncherCard
          description="Generate a secure candidate link and send it directly. The resulting assessment stays stored in the app."
          role_families={role_families}
          title="Direct test launcher"
          versions={versions}
        />

        <Card>
          <CardHeader>
            <CardTitle>Recent campaigns</CardTitle>
            <CardDescription>Track which campaigns are live, how many invites have gone out, and where completions are landing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaigns.length === 0 ? (
              <div className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey px-4 py-6 text-center text-sm text-brand-black/50">
                No campaigns yet. Create one from the admin panel to get started.
              </div>
            ) : null}
            {campaigns.slice(0, 6).map((campaign) => (
              <div key={campaign.id} className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-black">{campaign.name}</p>
                    <p className="text-sm text-brand-black/70">
                      {campaign.role_family_name} · {campaign.assessment_version_label}
                    </p>
                  </div>
                  <Badge tone={campaign.status === "ACTIVE" ? "success" : "neutral"}>{campaign.status}</Badge>
                </div>
                <p className="mt-3 text-sm text-brand-black/70">
                  {campaign.invites.length} invites · {campaign.invites.filter((invite) => invite.status === "COMPLETED").length} completed
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Recent direct links</CardTitle>
            <CardDescription>Every direct link below maps to a campaign invite and later becomes a stored assessment record.</CardDescription>
          </div>
          <Button disabled={is_refreshing} onClick={refresh_tests} variant="outline">
            {is_refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {administered_tests.length === 0 ? (
            <div className="col-span-full rounded-[1.4rem] border border-brand-black/10 bg-brand-grey px-4 py-6 text-center text-sm text-brand-black/50">
              No direct links generated yet. Use the launcher above to create the first one.
            </div>
          ) : null}
          {administered_tests.slice(0, 9).map((entry) => (
            <div key={entry.id} className="rounded-[1.4rem] border border-brand-black/10 bg-brand-grey px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-black">{entry.candidate_name}</p>
                  <p className="text-sm text-brand-black/70">{entry.role_family_name}</p>
                </div>
                <Badge tone={entry.status === "COMPLETED" ? "success" : entry.status === "SENT" ? "red" : "neutral"}>{entry.status}</Badge>
              </div>
              <p className="mt-3 text-sm text-brand-black/70">Generated {format_date(entry.created_at)}</p>
              <p className="mt-1 text-sm text-brand-black/70">
                {entry.assessment_id ? `Recorded assessment ${entry.assessment_id}` : "Assessment record will appear as soon as the candidate starts."}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
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
