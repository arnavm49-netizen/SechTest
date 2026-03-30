"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    <Button onClick={handle_logout} type="button" variant="outline" disabled={is_pending}>
      {is_pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
