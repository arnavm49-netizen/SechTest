"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PlatformError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Platform error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-[2rem] border border-brand-red/25 bg-brand-red/8 px-8 py-10">
        <h2 className="text-2xl font-semibold text-brand-black">Something went wrong</h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-brand-black/70">
          An unexpected error occurred while loading this page. This has been logged for review.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-brand-black/50">Error reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={unstable_retry}>Retry</Button>
          <Button onClick={() => (window.location.href = "/dashboard")} variant="outline">
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
