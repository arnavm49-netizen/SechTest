"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [is_pending, set_is_pending] = useState(false);

  async function handle_logout() {
    set_is_pending(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
      set_is_pending(false);
    }
  }

  return (
    <button
      className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-brand-black/40 transition-colors hover:bg-brand-black/[0.04] hover:text-brand-black/65"
      disabled={is_pending}
      onClick={handle_logout}
      type="button"
    >
      {is_pending ? "..." : "Sign out"}
    </button>
  );
}
