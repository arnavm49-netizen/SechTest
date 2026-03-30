"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [email, set_email] = useState("superadmin@secheron.example.com");
  const [password, set_password] = useState("Password@123");
  const [error, set_error] = useState("");
  const [is_pending, start_transition] = useTransition();

  function handle_submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    set_error("");

    start_transition(async () => {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        set_error(payload.message ?? "Unable to sign in.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-[520px] border-brand-black/12">
      <CardHeader>
        <p className="text-xs uppercase tracking-[0.28em] text-brand-red">Secure access</p>
        <CardTitle className="text-3xl">Step 1 foundation login</CardTitle>
        <CardDescription>
          Sign in with the seeded platform users to review the admin shell, role-based access controls, and user management.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handle_submit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-brand-black">Email</span>
            <input
              autoComplete="email"
              className="w-full rounded-[1.25rem] border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none transition focus:border-brand-red"
              onChange={(event) => set_email(event.target.value)}
              type="email"
              value={email}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-brand-black">Password</span>
            <input
              autoComplete="current-password"
              className="w-full rounded-[1.25rem] border border-brand-black/15 bg-brand-grey px-4 py-3 outline-none transition focus:border-brand-red"
              onChange={(event) => set_password(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="rounded-[1rem] bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-brand-black/70">
              Demo default: <span className="font-semibold text-brand-black">superadmin@secheron.example.com</span> /
              <span className="font-semibold text-brand-black"> Password@123</span>
            </p>
            <Button disabled={is_pending} type="submit">
              {is_pending ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
