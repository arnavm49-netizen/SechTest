export default function PlatformLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-20 rounded-md bg-brand-black/[0.06]" />
        <div className="h-7 w-56 rounded-lg bg-brand-black/[0.06]" />
        <div className="h-4 w-80 rounded-md bg-brand-black/[0.06]" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-brand-black/[0.06] bg-brand-white p-5">
            <div className="h-3 w-20 rounded bg-brand-black/[0.06]" />
            <div className="mt-3 h-8 w-16 rounded-lg bg-brand-black/[0.06]" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-56 rounded-2xl border border-brand-black/[0.06] bg-brand-white" />
        <div className="h-56 rounded-2xl border border-brand-black/[0.06] bg-brand-white" />
      </div>
    </div>
  );
}
