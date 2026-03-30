import { CandidateHome } from "@/components/candidate-home";
import { require_roles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function CandidatePage() {
  const user = await require_roles(["CANDIDATE"]);
  const [assessments, requests] = await Promise.all([
    prisma.assessment.findMany({
      where: {
        candidate_id: user.id,
        deleted_at: null,
      },
      include: {
        role_family: true,
      },
      orderBy: [{ created_at: "desc" }],
    }),
    prisma.governanceRequest.findMany({
      where: {
        deleted_at: null,
        org_id: user.org_id,
        user_id: user.id,
      },
      orderBy: [{ created_at: "desc" }],
    }),
  ]);

  return (
    <CandidateHome
      assessments={assessments.map((assessment) => ({
        id: assessment.id,
        role_family_name: assessment.role_family.name,
        status: assessment.status,
      }))}
      initial_requests={requests.map((request) => ({
        id: request.id,
        request_note: request.request_note,
        request_type: request.request_type,
        status: request.status,
      }))}
    />
  );
}
