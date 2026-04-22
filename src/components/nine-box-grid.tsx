"use client";

import { cn } from "@/lib/utils";

type NineBoxEntry = {
  candidate_name: string;
  performance_pct: number;
  potential_pct: number;
  role_family: string;
  nine_box: string;
  fit_score_pct: number;
};

type NineBoxGridProps = {
  entries: NineBoxEntry[];
};

const PERFORMANCE_LABELS = ["Low", "Moderate", "High"] as const;
const POTENTIAL_LABELS = ["Low", "Moderate", "High"] as const;

const CELL_LABELS: Record<string, string> = {
  "High-High": "Star",
  "High-Moderate": "High Performer",
  "High-Low": "Solid Performer",
  "Moderate-High": "High Potential",
  "Moderate-Moderate": "Core Player",
  "Moderate-Low": "Effective",
  "Low-High": "Rough Diamond",
  "Low-Moderate": "Inconsistent",
  "Low-Low": "Action Needed",
};

const CELL_COLORS: Record<string, string> = {
  "High-High": "bg-emerald-50 border-emerald-200",
  "High-Moderate": "bg-emerald-50/60 border-emerald-100",
  "High-Low": "bg-sky-50 border-sky-100",
  "Moderate-High": "bg-amber-50 border-amber-100",
  "Moderate-Moderate": "bg-brand-grey border-brand-black/[0.08]",
  "Moderate-Low": "bg-brand-grey border-brand-black/[0.06]",
  "Low-High": "bg-amber-50 border-amber-200",
  "Low-Moderate": "bg-orange-50 border-orange-100",
  "Low-Low": "bg-red-50 border-red-100",
};

function get_band(pct: number): "Low" | "Moderate" | "High" {
  if (pct >= 67) return "High";
  if (pct >= 33) return "Moderate";
  return "Low";
}

function get_cell_key(performance: string, potential: string) {
  return `${performance}-${potential}`;
}

export function NineBoxGrid({ entries }: NineBoxGridProps) {
  const grid_entries = entries.map((e) => ({
    ...e,
    perf_band: get_band(e.performance_pct),
    pot_band: get_band(e.potential_pct),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        {/* Y-axis label */}
        <div className="flex w-16 shrink-0 items-center justify-center">
          <span className="origin-center -rotate-90 whitespace-nowrap text-[11px] font-medium uppercase tracking-wider text-brand-black/40">
            Performance
          </span>
        </div>

        <div className="flex-1 space-y-1">
          {/* Grid rows — performance HIGH at top */}
          {([...PERFORMANCE_LABELS].reverse()).map((perf) => (
            <div key={perf} className="flex gap-1">
              {POTENTIAL_LABELS.map((pot) => {
                const key = get_cell_key(perf, pot);
                const cell_entries = grid_entries.filter(
                  (e) => e.perf_band === perf && e.pot_band === pot,
                );
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex-1 rounded-xl border p-3 transition-all duration-200",
                      CELL_COLORS[key] ?? "bg-brand-grey border-brand-black/[0.06]",
                      cell_entries.length > 0 && "shadow-sm",
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-black/35">
                      {CELL_LABELS[key]}
                    </p>
                    <p className="mt-0.5 text-[11px] text-brand-black/30">
                      {cell_entries.length} {cell_entries.length === 1 ? "person" : "people"}
                    </p>
                    <div className="mt-2 space-y-1">
                      {cell_entries.slice(0, 5).map((e, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-brand-white/80 px-2 py-1.5"
                        >
                          <span className="truncate text-[11px] font-medium text-brand-black">
                            {e.candidate_name}
                          </span>
                          <span className="ml-2 shrink-0 text-[10px] text-brand-black/40">
                            {Math.round(e.fit_score_pct)}%
                          </span>
                        </div>
                      ))}
                      {cell_entries.length > 5 ? (
                        <p className="text-[10px] text-brand-black/30">
                          +{cell_entries.length - 5} more
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* X-axis labels */}
          <div className="flex gap-1 pt-1">
            {POTENTIAL_LABELS.map((pot) => (
              <div key={pot} className="flex-1 text-center text-[11px] text-brand-black/35">
                {pot}
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] font-medium uppercase tracking-wider text-brand-black/40">
            Potential
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Stars", count: grid_entries.filter((e) => e.perf_band === "High" && e.pot_band === "High").length, color: "text-emerald-700" },
          { label: "High Potentials", count: grid_entries.filter((e) => e.pot_band === "High").length, color: "text-amber-700" },
          { label: "Action Needed", count: grid_entries.filter((e) => e.perf_band === "Low" && e.pot_band === "Low").length, color: "text-red-600" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-brand-grey p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-brand-black/40">{stat.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tracking-tight", stat.color)}>{stat.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
