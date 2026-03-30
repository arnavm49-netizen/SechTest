import { redirect } from "next/navigation";
import { get_session_user } from "@/lib/auth/session";
import { get_role_home } from "@/lib/rbac";

export default async function HomePage() {
  const user = await get_session_user();

  if (!user) {
    redirect("/login");
  }

  redirect(get_role_home(user.role));
}
