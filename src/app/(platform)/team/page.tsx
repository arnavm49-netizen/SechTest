import { TeamWorkspace } from "@/components/team-workspace";
import { require_roles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { build_individual_report_view, build_team_heatmap_view } from "@/lib/reporting-service";

export default async function TeamPage() {
  const user = await require_roles(["MANAGER", "HR_ADMIN", "SUPER_ADMIN"]);
  const heatmap = await build_team_heatmap_view({
    manager_id: user.role === "MANAGER" ? user.id : undefined,
    viewer: user,
  });
  const assessments = await prisma.assessment.findMany({
    where: {
      deleted_at: null,
      org_id: user.org_id,
      status: "COMPLETED",
      ...(user.role === "MANAGER"
        ? {
            candidate: {
              manager_id: user.id,
            },
          }
        : {}),
    },
    orderBy: [{ completed_at: "desc" }],
    take: 12,
    select: { id: true },
  });
  const reports = await Promise.all(
    assessments.map((assessment) =>
      build_individual_report_view({
        assessment_id: assessment.id,
        viewer: user,
      }),
    ),
  );

  return <TeamWorkspace initial_heatmap={heatmap} initial_reports={reports} />;
}
