"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SystemHealthSnapshot } from "@/lib/ui-types";

export function SystemHealthManager({ initial_snapshot }: { initial_snapshot: SystemHealthSnapshot }) {
  const [snapshot, set_snapshot] = useState(initial_snapshot);

  async function recompute() {
    const response = await fetch("/api/admin/system-health", {
      credentials: "include",
      method: "POST",
    });
    const payload = await response.json();
    if (response.ok && payload.snapshot) {
      set_snapshot(payload.snapshot);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">Implemented in Step 5</Badge>
        <h1 className="text-4xl font-semibold">System Health</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Failure-mode checks run against scoring, validation, 360, and outcome-linkage state so governance risks surface before they
          become operational failures.
        </p>
      </div>

      <Button onClick={() => void recompute()} type="button">
        Recompute health checks
      </Button>

      <div className="grid gap-4 xl:grid-cols-2">
        {snapshot.checks.map((check) => (
          <Card key={check.check_code}>
            <CardHeader>
              <CardTitle>{check.title}</CardTitle>
              <CardDescription>
                {check.severity} · {check.status}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-brand-black/70">{check.detail}</p>
              <p className="text-brand-black/70">Triggered: {check.trigger_summary ?? "No active trigger."}</p>
              <p className="text-brand-black/70">Next review: {check.next_review_at ?? "n/a"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
