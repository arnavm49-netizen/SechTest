"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ValiditySnapshot } from "@/lib/ui-types";

export function ValidityManager({ initial_snapshot }: { initial_snapshot: ValiditySnapshot }) {
  const [snapshot, set_snapshot] = useState(initial_snapshot);
  const [message, set_message] = useState<string | null>(null);

  async function recompute(validity_type?: string) {
    const response = await fetch("/api/admin/validity", {
      body: JSON.stringify(validity_type ? { validity_type } : {}),
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
        <Badge tone="red">Implemented in Step 5</Badge>
        <h1 className="text-4xl font-semibold">Validity Dashboard</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Construct, criterion, reliability, retest, adverse-impact, and incremental-validity evidence are tracked here with sample size
          warnings and recompute controls.
        </p>
        {message ? <p className="text-sm font-semibold text-brand-red">{message}</p> : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void recompute()} type="button">
          Recompute all validity evidence
        </Button>
        {["CRITERION", "INTERNAL_RELIABILITY", "ADVERSE_IMPACT"].map((type) => (
          <Button key={type} onClick={() => void recompute(type)} type="button" variant="outline">
            Recompute {type.replaceAll("_", " ")}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>Any failing or preliminary metric that needs admin attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {snapshot.alerts.length ? (
              snapshot.alerts.map((alert) => (
                <div key={`${alert.validity_type}-${alert.metric_name}-${alert.role_family_name}`} className="rounded-2xl border border-brand-red/20 px-4 py-3">
                  <p className="font-semibold text-brand-black">
                    {alert.validity_type} · {alert.metric_name}
                  </p>
                  <p className="text-brand-black/70">
                    {alert.role_family_name} · {alert.layer_name} · n={alert.sample_n}
                  </p>
                  <p className="mt-1 text-brand-black/70">{alert.notes ?? "Threshold breached or sample still preliminary."}</p>
                </div>
              ))
            ) : (
              <p className="text-brand-black/70">No active validity alerts.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Traffic-light matrix</CardTitle>
            <CardDescription>All evidence rows show threshold, sample, status, and the role/layer pairing they affect.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.evidence.map((entry, index) => (
              <div key={`${entry.validity_type}-${entry.metric_name}-${index}`} className="rounded-2xl border border-brand-black/10 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-black">
                      {entry.validity_type} · {entry.metric_name}
                    </p>
                    <p className="text-sm text-brand-black/70">
                      {entry.role_family_name} · {entry.layer_name} · n={entry.sample_n}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                      entry.status === "pass"
                        ? "bg-brand-black text-brand-white"
                        : entry.status === "warning"
                          ? "bg-brand-red/10 text-brand-red"
                          : entry.status === "fail"
                            ? "bg-brand-red text-brand-white"
                            : "bg-brand-grey text-brand-black"
                    }`}
                  >
                    {entry.preliminary ? "preliminary" : entry.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-brand-black/70">
                  Value: {entry.metric_value} · Threshold: {entry.threshold} · {entry.notes}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
