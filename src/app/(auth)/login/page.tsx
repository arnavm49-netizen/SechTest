import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-brand-grey">
      {/* Left — branding */}
      <div className="hidden flex-1 flex-col justify-between bg-brand-black p-10 text-brand-white lg:flex xl:p-14">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red">
              <span className="text-xs font-bold text-white">D&amp;H</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">D&amp;H Secheron</span>
          </div>
        </div>

        <div className="max-w-md space-y-5">
          <h1 className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight">
            Assessment
            <br />
            Platform
          </h1>
          <p className="text-[15px] leading-relaxed text-brand-white/55">
            Complete your assessment, view your results, or manage the
            assessment process — all from one place.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-brand-white/[0.08] bg-brand-white/[0.04] p-4">
            <p className="text-[13px] font-medium">For participants</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-brand-white/45">
              Log in to complete your assessment or view results.
            </p>
          </div>
          <div className="rounded-xl border border-brand-white/[0.08] bg-brand-white/[0.04] p-4">
            <p className="text-[13px] font-medium">For administrators</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-brand-white/45">
              Manage users, send test links, and review results.
            </p>
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:max-w-xl">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red">
              <span className="text-xs font-bold text-white">D&amp;H</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">D&amp;H Secheron</span>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
