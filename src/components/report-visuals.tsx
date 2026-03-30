"use client";

import type { HeatmapGridRow, RadarMetric } from "@/lib/ui-types";

export function RadarChart({ metrics }: { metrics: RadarMetric[] }) {
  const size = 240;
  const radius = 82;
  const center = size / 2;
  const polygon = metrics
    .map((metric, index) => {
      const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
      const scaled = (metric.score_0_100 / 100) * radius;
      const x = center + Math.cos(angle) * scaled;
      const y = center + Math.sin(angle) * scaled;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-4">
      <svg className="h-60 w-60" viewBox={`0 0 ${size} ${size}`}>
        {[20, 40, 60, 80, 100].map((ring) => {
          const points = metrics
            .map((_, index) => {
              const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
              const scaled = (ring / 100) * radius;
              const x = center + Math.cos(angle) * scaled;
              const y = center + Math.sin(angle) * scaled;
              return `${x},${y}`;
            })
            .join(" ");

          return <polygon key={ring} points={points} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />;
        })}
        {metrics.map((_, index) => {
          const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return <line key={index} x1={center} y1={center} x2={x} y2={y} stroke="rgba(0,0,0,0.15)" strokeWidth="1" />;
        })}
        <polygon fill="rgba(237,51,56,0.18)" points={polygon} stroke="#ed3338" strokeWidth="3" />
      </svg>
      <div className="grid w-full gap-2 md:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-brand-black/10 bg-brand-grey px-4 py-3 text-sm">
            <div className="font-semibold text-brand-black">{metric.label}</div>
            <div className="text-brand-black/70">{metric.score_0_100} / 100</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeatmapGrid({ rows, sub_dimensions }: { rows: HeatmapGridRow[]; sub_dimensions: string[] }) {
  return (
    <div className="overflow-x-auto rounded-[2rem] border border-brand-black/10">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-brand-grey">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Team member</th>
            <th className="px-4 py-3 text-left font-semibold">Role</th>
            <th className="px-4 py-3 text-left font-semibold">Recommendation</th>
            {sub_dimensions.map((sub_dimension) => (
              <th key={sub_dimension} className="px-4 py-3 text-left font-semibold">
                {sub_dimension}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.candidate_name}-${row.role_family_name}`} className="border-t border-brand-black/8">
              <td className="px-4 py-3 font-semibold text-brand-black">{row.candidate_name}</td>
              <td className="px-4 py-3 text-brand-black/70">{row.role_family_name}</td>
              <td className="px-4 py-3 text-brand-black/70">{row.recommendation ?? "Pending"}</td>
              {row.scores.map((score) => (
                <td
                  key={`${row.candidate_name}-${score.sub_dimension_name}`}
                  className="px-4 py-3"
                  style={{
                    background:
                      score.tone === "green"
                        ? "rgba(0,0,0,0.09)"
                        : score.tone === "amber"
                          ? "rgba(237,51,56,0.10)"
                          : score.tone === "red"
                            ? "rgba(237,51,56,0.18)"
                            : "rgba(240,238,238,1)",
                  }}
                >
                  {score.score === null ? "n/a" : score.score.toFixed(1)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
