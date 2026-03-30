import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { require_roles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { format_date } from "@/lib/utils";

export default async function AuditPage() {
  await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);

  const events = await prisma.auditLog.findMany({
    where: { deleted_at: null },
    orderBy: { timestamp: "desc" },
    take: 20,
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge tone="red">Compliance and audit</Badge>
        <h1 className="text-4xl font-semibold">Recent auditable activity</h1>
        <p className="max-w-4xl text-base leading-8 text-brand-black/70">
          Login, user creation, user updates, deactivation actions, token refreshes, and API activity are written into the immutable audit
          trail.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest events</CardTitle>
          <CardDescription>The list below is sourced from the live audit_log table.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.map((event) => (
            <div className="rounded-[1.4rem] bg-brand-grey px-4 py-4" key={event.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold">{event.action}</p>
                <p className="text-sm text-brand-black/60">{format_date(event.timestamp)}</p>
              </div>
              <p className="mt-1 text-sm text-brand-black/75">
                {event.target_entity}
                {event.target_id ? ` • ${event.target_id}` : ""}
              </p>
              <p className="mt-1 text-sm text-brand-black/60">{event.user?.name ?? event.user?.email ?? "System"}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
