"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";

type LoginMode = "participant" | "admin";

export function LoginForm() {
  const router = useRouter();
  const [mode, set_mode] = useState<LoginMode>("participant");
  const [email, set_email] = useState("");
  const [password, set_password] = useState("");
  const [error, set_error] = useState("");
  const [is_pending, start_transition] = useTransition();

  function switch_mode(next_mode: LoginMode) {
    set_mode(next_mode);
    set_email("");
    set_password("");
    set_error("");
  }

  function handle_submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    set_error("");

    if (!email.trim() || !password.trim()) {
      set_error("Please enter your email and password.");
      return;
    }

    start_transition(async () => {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        set_error(payload.message ?? "Unable to sign in. Please check your credentials.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    });
  }

  const input_class =
    "w-full rounded-xl border border-brand-black/[0.1] bg-brand-white px-3.5 py-2.5 text-sm text-brand-black placeholder:text-brand-black/30 outline-none transition-colors focus:border-brand-black/30 focus:ring-2 focus:ring-brand-black/[0.06]";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
        <p className="mt-1.5 text-[13px] text-brand-black/50">
          {mode === "participant"
            ? "View your assessment results and feedback reports."
            : "Manage assessments, users, and platform settings."}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-brand-black/[0.04] p-1">
        {(["participant", "admin"] as const).map((m) => (
          <button
            className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all duration-200 ${
              mode === m
                ? "bg-brand-white text-brand-black shadow-sm"
                : "text-brand-black/45 hover:text-brand-black/65"
            }`}
            key={m}
            onClick={() => switch_mode(m)}
            type="button"
          >
            {m === "participant" ? "Participant" : "Administrator"}
          </button>
        ))}
      </div>

      <form className="space-y-4" onSubmit={handle_submit}>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-brand-black/70">Email</span>
          <input
            autoComplete="email"
            className={input_class}
            onChange={(event) => set_email(event.target.value)}
            placeholder={mode === "participant" ? "your.name@example.com" : "admin@secheron.example.com"}
            type="email"
            value={email}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-brand-black/70">Password</span>
          <input
            autoComplete="current-password"
            className={input_class}
            onChange={(event) => set_password(event.target.value)}
            placeholder="Enter your password"
            type="password"
            value={password}
          />
        </label>

        {error ? (
          <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-brand-red">
            {error}
          </div>
        ) : null}

        <Button className="w-full" disabled={is_pending} type="submit">
          {is_pending ? "Signing in..." : "Sign in"}
        </Button>

        {mode === "participant" ? (
          <p className="text-center text-[12px] leading-relaxed text-brand-black/40">
            Your credentials were provided when you were registered.
            <br />
            Contact your HR administrator if you need help.
          </p>
        ) : null}
      </form>
    </div>
  );
}
