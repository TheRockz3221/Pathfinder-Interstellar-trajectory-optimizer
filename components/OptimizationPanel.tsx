"use client";

import { Activity, LoaderCircle } from "lucide-react";
import type { OptimizationRun } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function OptimizationPanel({ runs, isOptimizing }: { runs: OptimizationRun[]; isOptimizing: boolean }) {
  const latest = runs.at(-1);

  return (
    <section className="panel p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={17} className="text-cyan-signal" />
          <h2 className="text-base font-semibold text-white">Optimization Engine</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-cyan-signal/25 bg-cyan-signal/10 px-2 py-1 text-xs text-cyan-soft">
          {isOptimizing && <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />}
          {isOptimizing ? "Optimizing…" : latest?.algorithm ?? "Ready"}
        </span>
      </div>
      {isOptimizing && (
        <p className="mb-3 text-sm text-slate-300" role="status">
          Evaluating mission variants…
        </p>
      )}
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <Mini label="Generation" value={latest ? latest.generation : 0} />
        <Mini label="Best score" value={latest ? formatNumber(latest.score, 1) : "0"} />
        <Mini label="Fuel used" value={latest ? `${formatNumber(latest.fuelUsedKg, 0)} kg` : "0 kg"} />
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
