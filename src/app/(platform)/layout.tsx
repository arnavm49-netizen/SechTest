import { AppShell } from "@/components/app-shell";
import { require_user } from "@/lib/auth/session";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await require_user();

  return <AppShell user={user}>{children}</AppShell>;
}
