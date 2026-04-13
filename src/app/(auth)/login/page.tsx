import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-brand-grey px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[84vh] max-w-7xl items-center gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="space-y-6 rounded-[2.2rem] bg-brand-black px-6 py-8 text-brand-white shadow-soft sm:px-8 lg:px-10">
          <p className="text-xs uppercase tracking-[0.32em] text-brand-red">D&amp;H Secheron</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-[2.8rem]">
            Assessment Platform
          </h1>
          <p className="max-w-2xl text-base leading-7 text-brand-white/72 sm:text-lg">
            Complete your assessment, view your results, or manage the assessment process — all from one place.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">For participants</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">
                Log in to complete your assessment or view your results and feedback report once it is ready.
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">For administrators</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">
                Manage users, send test links, configure scoring, and review results across all participants.
              </p>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/5 p-5">
            <p className="text-sm font-semibold">Have an assessment link?</p>
            <p className="mt-2 text-sm leading-6 text-brand-white/68">
              If you received a direct assessment link via email, simply click it to start — no login required. You can log in here
              afterwards to view your results.
            </p>
          </div>
        </section>

        <div className="flex justify-center lg:justify-end">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
