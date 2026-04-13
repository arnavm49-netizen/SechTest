export default function PlatformLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-4">
        <div className="h-6 w-32 rounded-full bg-brand-grey" />
        <div className="h-10 w-80 rounded-[1rem] bg-brand-grey" />
        <div className="h-5 w-[32rem] max-w-full rounded-[1rem] bg-brand-grey" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[1.5rem] border border-brand-black/10 bg-brand-grey px-4 py-6">
            <div className="h-4 w-20 rounded bg-brand-black/10" />
            <div className="mt-3 h-8 w-16 rounded bg-brand-black/10" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-64 rounded-[1.5rem] border border-brand-black/10 bg-brand-grey" />
        <div className="h-64 rounded-[1.5rem] border border-brand-black/10 bg-brand-grey" />
      </div>
    </div>
  );
}
