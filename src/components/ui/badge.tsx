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
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        tone === "neutral" && "bg-brand-black/[0.05] text-brand-black/65",
        tone === "red" && "bg-brand-red/[0.08] text-brand-red",
        tone === "success" && "bg-emerald-50 text-emerald-700",
      )}
    >
      {children}
    </span>
  );
}
