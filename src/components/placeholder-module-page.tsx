import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PlaceholderModulePage({
  delivery_phase,
  summary,
  title,
}: {
  delivery_phase: string;
  summary: string;
  title: string;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">{delivery_phase}</Badge>
        <h1 className="text-4xl font-semibold">{title}</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/72">{summary}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step placeholder</CardTitle>
          <CardDescription>
            This module is intentionally scaffolded in Step 1 so navigation, RBAC, and system structure are testable before the
            underlying domain workflows are filled in.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.4rem] bg-brand-grey p-4">
            <p className="text-sm font-semibold">Current state</p>
            <p className="mt-2 text-sm leading-6 text-brand-black/70">Navigation, access control, and placeholder content are live.</p>
          </div>
          <div className="rounded-[1.4rem] bg-brand-grey p-4">
            <p className="text-sm font-semibold">Next build step</p>
            <p className="mt-2 text-sm leading-6 text-brand-black/70">Populate this workspace with the step-specific workflows from the master spec.</p>
          </div>
          <div className="rounded-[1.4rem] bg-brand-grey p-4">
            <p className="text-sm font-semibold">Why it exists now</p>
            <p className="mt-2 text-sm leading-6 text-brand-black/70">
              Early stakeholders can validate information architecture and permissions before deeper implementation starts.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
