export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded-md bg-brand-black/[0.06]" />
        <div className="h-7 w-48 rounded-lg bg-brand-black/[0.06]" />
        <div className="h-4 w-72 rounded-md bg-brand-black/[0.06]" />
      </div>

      <div className="h-64 rounded-2xl border border-brand-black/[0.06] bg-brand-white" />
      <div className="h-80 rounded-2xl border border-brand-black/[0.06] bg-brand-white" />
    </div>
  );
}
