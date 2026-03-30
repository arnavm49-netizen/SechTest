import { CandidateAssessmentApp } from "@/components/candidate-assessment-app";
import type { AssessmentSession } from "@/lib/assessment-session";
import { hydrate_assessment_session } from "@/lib/assessment-runtime";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export default async function AssessmentInvitePage({ params }: RouteContext) {
  const { token } = await params;
  const session = (await hydrate_assessment_session(token).catch(() => null)) as AssessmentSession | null;

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-[2rem] border border-brand-red/20 bg-brand-white px-6 py-10 text-center shadow-soft">
          <p className="text-sm uppercase tracking-[0.24em] text-brand-red">Invite unavailable</p>
          <h1 className="mt-3 text-3xl font-semibold">This assessment link is no longer valid.</h1>
        </div>
      </div>
    );
  }

  return <CandidateAssessmentApp initial_session={session} token={token} />;
}
