"use client";

import { Button } from "@/components/ui/button";

export default function PlatformError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <p className="text-5xl font-semibold tracking-tight text-brand-red">Error</p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-brand-black/50">
          An unexpected error occurred. Please try again or return to the dashboard.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[11px] text-brand-black/30">Ref: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={unstable_retry}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>Dashboard</Button>
        </div>
      </div>
    </div>
  );
}
