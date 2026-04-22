"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <p className="text-5xl font-semibold tracking-tight text-brand-red">Error</p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Module error</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-brand-black/50">
          This admin module encountered an error. Other modules should still be accessible.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[11px] text-brand-black/30">Ref: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={unstable_retry}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/admin")}>Back to admin</Button>
        </div>
      </div>
    </div>
  );
}
