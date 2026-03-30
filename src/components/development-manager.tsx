"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DevelopmentSnapshot } from "@/lib/ui-types";

export function DevelopmentManager({ initial_snapshot }: { initial_snapshot: DevelopmentSnapshot }) {
  const [snapshot, set_snapshot] = useState(initial_snapshot);
  const [message, set_message] = useState<string | null>(null);

  async function create_recommendation(form: HTMLFormElement) {
    const form_data = new FormData(form);
    const response = await fetch("/api/admin/development", {
      body: JSON.stringify({
        recommendation_text: String(form_data.get("recommendation_text")),
        reassessment_trigger: String(form_data.get("reassessment_trigger")),
        score_range_max: Number(form_data.get("score_range_max")),
        score_range_min: Number(form_data.get("score_range_min")),
        sub_dimension_id: String(form_data.get("sub_dimension_id")),
        timeline: String(form_data.get("timeline")),
      }),
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
        <Badge tone="red">Implemented in Step 4</Badge>
        <h1 className="text-4xl font-semibold">Development Plan Configuration</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          The intervention library used by auto-generated IDPs is editable here by sub-dimension, score band, timeline, and reassessment
          trigger.
        </p>
        {message ? <p className="text-sm font-semibold text-brand-red">{message}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create development recommendation</CardTitle>
            <CardDescription>Recommendations are linked directly to sub-dimensions and score bands.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void create_recommendation(event.currentTarget);
              }}
            >
              <select className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="sub_dimension_id">
                {snapshot.sub_dimensions.map((sub_dimension) => (
                  <option key={sub_dimension.id} value={sub_dimension.id}>
                    {sub_dimension.label}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" defaultValue="0" name="score_range_min" type="number" />
                <input className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" defaultValue="60" name="score_range_max" type="number" />
              </div>
              <input className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="timeline" placeholder="Timeline" />
              <input className="rounded-full border border-brand-black/15 px-4 py-3 text-sm" name="reassessment_trigger" placeholder="Reassessment trigger" />
              <textarea className="min-h-28 rounded-[1.5rem] border border-brand-black/15 px-4 py-3 text-sm" name="recommendation_text" placeholder="Recommendation text" />
              <Button type="submit">Create recommendation</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current recommendation library</CardTitle>
            <CardDescription>Visible to scoring and reporting whenever a gap falls inside the configured score range.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {snapshot.recommendations.map((recommendation) => (
              <div key={recommendation.id} className="rounded-2xl border border-brand-black/10 px-4 py-4">
                <p className="font-semibold text-brand-black">{recommendation.sub_dimension_name}</p>
                <p className="text-brand-black/70">
                  {recommendation.score_range_min} - {recommendation.score_range_max} · {recommendation.timeline}
                </p>
                <p className="mt-2 text-brand-black/70">{recommendation.recommendation_text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
