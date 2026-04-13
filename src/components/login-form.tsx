"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

  return (
    <Card className="w-full max-w-[520px] border-brand-black/12">
      <CardHeader>
        <div className="flex gap-2">
          <button
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              mode === "participant"
                ? "border-brand-red bg-brand-red text-brand-white"
                : "border-brand-black/15 bg-brand-grey text-brand-black hover:border-brand-red/50"
            }`}
            onClick={() => switch_mode("participant")}
            type="button"
          >
            Participant
          </button>
          <button
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              mode === "admin"
                ? "border-brand-red bg-brand-red text-brand-white"
                : "border-brand-black/15 bg-brand-grey text-brand-black hover:border-brand-red/50"
            }`}
            onClick={() => switch_mode("admin")}
            type="button"
          >
            Administrator
          </button>
        </div>
        <CardTitle className="mt-2 text-3xl">
          {mode === "participant" ? "Participant login" : "Admin login"}
        </CardTitle>
        <CardDescription>
          {mode === "participant"
            ? "Sign in to view your assessment results and feedback reports."
            : "Sign in to manage assessments, users, and platform settings."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handle_submit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-brand-black">Email</span>
            <input
              autoComplete="email"
              className="w-full min-w-0 rounded-[1.15rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
              onChange={(event) => set_email(event.target.value)}
              placeholder={mode === "participant" ? "your.name@example.com" : "admin@secheron.example.com"}
              type="email"
              value={email}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-brand-black">Password</span>
            <input
              autoComplete="current-password"
              className="w-full min-w-0 rounded-[1.15rem] border border-brand-black/15 bg-brand-grey px-4 py-3 text-sm outline-none transition focus:border-brand-red"
              onChange={(event) => set_password(event.target.value)}
              placeholder="Enter your password"
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="rounded-[1rem] bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</p> : null}

          <Button className="w-full" disabled={is_pending} type="submit">
            {is_pending ? "Signing in..." : "Sign in"}
          </Button>

          {mode === "participant" ? (
            <p className="rounded-[1rem] bg-brand-grey px-4 py-3 text-sm leading-6 text-brand-black/65">
              Your login credentials were provided when you were registered for the assessment. If you cannot remember them,
              please contact your HR administrator.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
