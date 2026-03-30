import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "red" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        tone === "neutral" && "border-brand-black/15 bg-brand-grey text-brand-black",
        tone === "red" && "border-brand-red/30 bg-brand-red/10 text-brand-red",
        tone === "success" && "border-brand-black bg-brand-black text-brand-white",
      )}
    >
      {children}
    </span>
  );
}
