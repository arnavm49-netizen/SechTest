import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-brand-grey px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[84vh] max-w-7xl items-center gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="space-y-6 rounded-[2.2rem] bg-brand-black px-6 py-8 text-brand-white shadow-soft sm:px-8 lg:px-10">
          <p className="text-xs uppercase tracking-[0.32em] text-brand-red">Assessment Platform</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-[2.8rem]">
            Create, send, and track assessments from one place.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-brand-white/72 sm:text-lg">
            The D&amp;H Secheron assessment platform handles everything from sending test links to candidates, to scoring their responses
            and generating reports.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">Secure access</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">Role-based access ensures each user only sees what they need. All activity is logged.</p>
            </div>
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">Easy test delivery</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">Generate assessment links and send them to candidates. Results are captured automatically.</p>
            </div>
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">Clear, simple interface</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">Designed for HR teams, not engineers. Everything is organised and easy to find.</p>
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
