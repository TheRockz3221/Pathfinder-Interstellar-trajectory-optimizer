"use client";

import { Activity } from "lucide-react";
import type { OptimizationRun } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function OptimizationPanel({ runs }: { runs: OptimizationRun[] }) {
  const latest = runs.at(-1);

  return (
    <section className="glass rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={17} className="text-cyan-signal" />
          <h2 className="text-base font-semibold text-white">Optimization Engine</h2>
        </div>
        <span className="rounded-md border border-cyan-signal/25 bg-cyan-signal/10 px-2 py-1 text-xs text-cyan-soft">
          {latest?.algorithm}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Mini label="Generation" value={latest ? latest.generation : 0} />
        <Mini label="Best score" value={latest ? formatNumber(latest.score, 1) : "0"} />
        <Mini label="Fuel used" value={latest ? `${formatNumber(latest.fuelUsedKg, 0)} kg` : "0 kg"} />
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
