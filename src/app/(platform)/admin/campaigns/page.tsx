import { CampaignManager } from "@/components/campaign-manager";
import { require_roles } from "@/lib/auth/session";
import { list_assessment_versions } from "@/lib/assessment-configuration";
import { list_campaigns } from "@/lib/campaigns";
import { prisma } from "@/lib/db";

export default async function CampaignsPage() {
  const user = await require_roles(["SUPER_ADMIN", "HR_ADMIN"]);
  const [campaigns, versions, role_families, candidates] = await Promise.all([
    list_campaigns(user.org_id),
    list_assessment_versions(user.org_id),
    prisma.roleFamily.findMany({
      where: {
        deleted_at: null,
        org_id: user.org_id,
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        org_id: user.org_id,
        role: "CANDIDATE",
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <CampaignManager
      candidates={candidates.map((candidate) => ({
        email: candidate.email,
        id: candidate.id,
        name: candidate.name,
      }))}
      initial_campaigns={campaigns}
      role_families={role_families.map((role_family) => ({
        id: role_family.id,
        name: role_family.name,
      }))}
      versions={versions}
    />
  );
}
