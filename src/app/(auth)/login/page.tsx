import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-brand-grey px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[84vh] max-w-7xl items-center gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="space-y-6 rounded-[2.2rem] bg-brand-black px-6 py-8 text-brand-white shadow-soft sm:px-8 lg:px-10">
          <p className="text-xs uppercase tracking-[0.32em] text-brand-red">Enterprise Psychometrics</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-[2.8rem]">
            Launch, administer, score, and track assessments from one calm workspace.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-brand-white/72 sm:text-lg">
            The platform now handles login, governed admin access, direct assessment link generation, and in-app result capture for D&amp;H
            Secheron.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">Trusted access</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">Seeded admin login, JWT sessions, refresh rotation, and audit trails.</p>
            </div>
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">Assessment delivery</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">Direct administered-test links feed the same candidate runtime and scoring flow.</p>
            </div>
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">Clean operating UI</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">Compact cards, controlled wrapping, and inputs sized to stay usable on screen.</p>
            </div>
          </div>
        </section>

        <div className="flex justify-center lg:justify-end">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
