"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { get_primary_navigation } from "@/lib/rbac";
import { cn, format_role_label } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

export function AppShell({ children, user }: { children: React.ReactNode; user: SessionUser }) {
  const pathname = usePathname();
  const navigation = get_primary_navigation(user.role);

  return (
    <div className="min-h-screen bg-brand-grey text-brand-black">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="w-full bg-brand-black px-5 py-6 text-brand-white lg:sticky lg:top-0 lg:h-screen lg:w-[290px] lg:px-6 lg:py-8">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-brand-white/60">Assessment Platform</p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight">D&amp;H Secheron</h1>
              <p className="mt-3 max-w-xs text-sm leading-6 text-brand-white/70">Manage assessments, send test invitations, review results, and track team development.</p>
            </div>

            <div className="rounded-[1.75rem] border border-brand-white/15 bg-brand-white/8 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-brand-white/60">Signed in</p>
              <p className="mt-2 text-lg font-semibold">{user.name}</p>
              <p className="text-sm text-brand-white/72">{user.email}</p>
              <p className="mt-3 text-sm text-brand-red">{format_role_label(user.role)}</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-2">
            {navigation.map((item) => {
              const is_active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={cn(
                    "rounded-[1.4rem] border px-4 py-3 transition",
                    is_active
                      ? "border-brand-red bg-brand-red text-brand-white"
                      : "border-brand-white/12 bg-transparent text-brand-white/78 hover:border-brand-red/50 hover:text-brand-white",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className={cn("mt-1 max-w-[16rem] text-xs leading-5", is_active ? "text-brand-white/85" : "text-brand-white/55")}>
                    {item.description}
                  </p>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
          <header className="flex flex-col gap-4 rounded-[2rem] border border-brand-black/10 bg-brand-white px-5 py-5 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-brand-red">Assessment workspace</p>
              <h2 className="mt-2 text-2xl font-semibold">Welcome, {user.name.split(" ")[0]}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-black/70">Manage assessments, send test links, and review results all in one place.</p>
            </div>
            <LogoutButton />
          </header>

          <main className="min-w-0 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
