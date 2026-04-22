"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-grey px-6">
      <div className="max-w-sm text-center">
        <p className="text-5xl font-semibold tracking-tight text-brand-red">Error</p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-brand-black">Something went wrong</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-brand-black/50">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[11px] text-brand-black/30">Ref: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-black px-5 text-sm font-medium text-brand-white transition-colors hover:bg-brand-black/85"
            onClick={unstable_retry}
            type="button"
          >
            Try again
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-brand-black/[0.12] bg-brand-white px-5 text-sm font-medium text-brand-black transition-colors hover:bg-brand-grey"
            onClick={() => (window.location.href = "/")}
            type="button"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
