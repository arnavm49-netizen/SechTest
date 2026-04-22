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
      <div className="flex min-h-screen items-center justify-center bg-brand-grey px-5">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-red/[0.08]">
            <span className="text-lg text-brand-red">!</span>
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Link no longer valid</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-brand-black/50">
            This assessment link may have expired or already been used. Please contact your HR administrator or the
            person who sent you this link to request a new one.
          </p>
        </div>
      </div>
    );
  }

  return <CandidateAssessmentApp initial_session={session} token={token} />;
}
