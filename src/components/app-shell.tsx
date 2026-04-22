"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { get_primary_navigation } from "@/lib/rbac";
import { cn, format_role_label } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

const PARTICIPANT_ROLES = new Set(["CANDIDATE", "RATER"]);

function get_role_badge(role: string) {
  if (role === "SUPER_ADMIN" || role === "HR_ADMIN") return "Administrator";
  if (role === "MANAGER") return "Manager";
  if (role === "ASSESSOR") return "Assessor";
  if (role === "CANDIDATE") return "Participant";
  if (role === "RATER") return "Reviewer";
  return format_role_label(role);
}

export function AppShell({ children, user }: { children: React.ReactNode; user: SessionUser }) {
  const pathname = usePathname();
  const navigation = get_primary_navigation(user.role);
  const is_participant = PARTICIPANT_ROLES.has(user.role);

  return (
    <div className="min-h-screen bg-brand-grey text-brand-black">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col xl:flex-row">

        {/* ── Sidebar ── */}
        <aside className="flex w-full flex-col bg-brand-white/80 backdrop-blur-xl xl:sticky xl:top-0 xl:h-screen xl:w-[260px] xl:border-r xl:border-brand-black/[0.06]">

          {/* Brand */}
          <div className="px-5 pt-6 pb-4 xl:px-6 xl:pt-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red">
                <span className="text-xs font-bold text-white">D&amp;H</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-brand-black">
                  {is_participant ? "My Assessments" : "Assessment Platform"}
                </p>
                <p className="text-[11px] text-brand-black/45">D&amp;H Secheron</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 xl:px-4">
            {navigation.map((item) => {
              const is_active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={cn(
                    "group flex flex-col rounded-xl px-3 py-2.5 transition-colors duration-150",
                    is_active
                      ? "bg-brand-black text-brand-white"
                      : "text-brand-black/65 hover:bg-brand-black/[0.04] hover:text-brand-black",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <span className="text-[13px] font-medium">{item.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 text-[11px] leading-snug",
                      is_active ? "text-brand-white/60" : "text-brand-black/40",
                    )}
                  >
                    {item.description}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="border-t border-brand-black/[0.06] px-4 py-4 lg:px-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-brand-black">{user.name}</p>
                <p className="truncate text-[11px] text-brand-black/45">{get_role_badge(user.role)}</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-brand-black/[0.06] bg-brand-grey/80 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-10">
            <p className="text-[11px] font-medium uppercase tracking-wider text-brand-red">
              {is_participant ? "Participant portal" : "Admin workspace"}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h2>
          </header>

          <main className="px-5 py-6 sm:px-8 lg:px-10 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
