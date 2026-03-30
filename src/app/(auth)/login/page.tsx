import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-brand-grey px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[85vh] max-w-7xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6 rounded-[2.5rem] bg-brand-black px-8 py-10 text-brand-white shadow-soft sm:px-10">
          <p className="text-xs uppercase tracking-[0.32em] text-brand-red">Phase 1 foundation</p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight">Enterprise psychometric infrastructure for decision-grade assessments.</h1>
          <p className="max-w-2xl text-lg leading-8 text-brand-white/72">
            This build establishes the data model, seeded assessment architecture, JWT authentication, role-based access, admin shell,
            user management, and audit-ready controls for D&amp;H Secheron.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">Step 1 scope</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">Schema, migrations, seeds, auth, RBAC, and admin shell.</p>
            </div>
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">Brand system</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">Century Schoolbook, black, white, red, and grey across the product.</p>
            </div>
            <div className="rounded-[1.6rem] border border-brand-white/10 bg-brand-white/8 p-5">
              <p className="text-sm font-semibold">Security posture</p>
              <p className="mt-2 text-sm leading-6 text-brand-white/68">Short-lived access JWT, rotating refresh token, audit logging, and rate limiting.</p>
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
