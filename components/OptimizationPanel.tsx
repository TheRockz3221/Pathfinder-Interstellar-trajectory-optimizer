"use client";

import { useState } from "react";
import { Activity, LoaderCircle } from "lucide-react";
import type { SeedSummary } from "@/lib/optimization/optimizer";
import type { OptimizationRun } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type Props = {
  runs: OptimizationRun[];
  isOptimizing: boolean;
  seedSummary: SeedSummary | null;
  error: string;
  onRunSeeds: (count: number) => void;
};

export function OptimizationPanel({ runs, isOptimizing, seedSummary, error, onRunSeeds }: Props) {
  const [seedCount, setSeedCount] = useState(5);
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
        <Mini label="Best Score" value={latest ? formatNumber(latest.score, 1) : "0"} />
        <Mini label="Fuel used" value={latest ? `${formatNumber(latest.fuelUsedKg, 0)} kg` : "0 kg"} />
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-slate-400">
          <span className="block uppercase tracking-[0.1em]">Seeds</span>
          <input
            type="number"
            min={1}
            max={20}
            value={seedCount}
            onChange={(event) => setSeedCount(Math.min(20, Math.max(1, Math.floor(Number(event.target.value) || 1))))}
            className="field w-24"
          />
        </label>
        <button
          type="button"
          onClick={() => onRunSeeds(seedCount)}
          disabled={isOptimizing}
          className="h-10 rounded-md border border-cyan-signal/25 bg-cyan-signal/10 px-3 text-sm text-cyan-soft disabled:cursor-wait disabled:opacity-60"
        >
          Run {seedCount} seeds
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-plasma" role="alert">{error}</p>}
      {seedSummary && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs uppercase tracking-[0.1em] text-slate-400">
            {seedSummary.count} seed results · mean (min–max)
          </h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <SeedMetric label="Simulated window (yr)" range={seedSummary.travelTimeYears} />
            <SeedMetric label="Delta-v (km/s)" range={seedSummary.deltaVKps} />
            <SeedMetric label="Score" range={seedSummary.score} />
          </div>
        </div>
      )}
    </section>
  );
}

function SeedMetric({ label, range }: { label: string; range: SeedSummary["score"] }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">
        {formatNumber(range.mean, 2)} ({formatNumber(range.min, 2)}–{formatNumber(range.max, 2)})
      </p>
    </div>
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
