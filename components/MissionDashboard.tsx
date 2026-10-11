"use client";

import { Gauge, Route, Timer, Zap } from "lucide-react";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { AU_M, YEAR_S, celestialBodies } from "@/lib/constants/celestial-bodies";
import { orbitalEnergy } from "@/lib/physics/orbital";

type Props = {
  mission: MissionConfig;
  result: TrajectoryResult;
};

export function MissionDashboard({ mission, result }: Props) {
  const finalStep = result.simulationData.at(-1);
  const specificEnergy = finalStep ? orbitalEnergy(finalStep.position, finalStep.velocity) : Number.NEGATIVE_INFINITY;
  const asymptoticSpeedMps = specificEnergy > 0 ? Math.sqrt(2 * specificEnergy) : null;
  const estimatedTransitYears = asymptoticSpeedMps
    ? (celestialBodies["Alpha Centauri"].semiMajorAxisAu * AU_M) / asymptoticSpeedMps / YEAR_S
    : null;
  const metrics = [
    { label: `Simulated window (≤ ${mission.maxMissionDurationYears} yr)`, value: `${formatNumber(result.travelTimeYears, 1)} yr`, icon: Timer },
    { label: "Distance", value: `${formatNumber(result.totalDistanceAu, 1)} AU`, icon: Route },
    { label: "Max velocity", value: `${formatNumber(result.maxVelocityKps, 1)} km/s`, icon: Gauge },
    { label: "Delta-v", value: `${formatNumber(result.deltaVKps, 2)} km/s`, icon: Zap }
  ];

  return (
    <section className="panel min-w-0 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">Mission Summary</h2>
          <p className="break-words text-sm text-slate-300">{mission.launchBody} to {mission.destination}</p>
        </div>
        <div className="shrink-0 rounded-md border border-gold-mission/30 bg-gold-mission/10 px-3 py-2 text-right">
          <p className="text-xs uppercase text-gold-mission">Score</p>
          <p className="text-2xl font-semibold text-white">{formatNumber(result.optimizationScore, 1)}</p>
        </div>
      </div>
      <div className="metric-grid min-w-0 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="min-w-0 rounded-md border border-white/10 bg-white/[0.045] p-3">
              <div className="mb-2 flex items-center gap-2 text-cyan-soft">
                <Icon size={16} className="shrink-0" />
                <span className="text-xs uppercase tracking-[0.12em]">{metric.label}</span>
              </div>
              <p className="break-words text-lg font-semibold text-white sm:text-xl">{metric.value}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Fuel remaining</p>
          <p className="break-words text-lg font-semibold text-emerald">{formatNumber(result.fuelRemainingKg, 0)} kg</p>
        </div>
        <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Planned assists</p>
          <p className="break-words text-lg font-semibold text-white">
            {mission.gravityAssists.map((assist) => assist.planetName).join(" -> ") || "Direct"}
          </p>
        </div>
        <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Flybys applied</p>
          <p className="break-words text-lg font-semibold text-white">
            {result.gravityAssistEvents.map((event) => event.planetName).join(" -> ") || "None"}
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-md border border-cyan-signal/20 bg-cyan-signal/[0.04] p-3">
        <p className="text-xs uppercase tracking-[0.12em] text-cyan-soft">Estimated full transit to Alpha Centauri</p>
        <p className="mt-1 break-words text-lg font-semibold text-white">
          {estimatedTransitYears === null ? "Not available (non-positive solar specific energy)" : `~${formatNumber(estimatedTransitYears, 0)} yr`}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Estimate only: 276,000 AU ÷ v∞, where v∞ = √(2 × final solar specific energy)
          {asymptoticSpeedMps === null ? "" : ` = ${formatNumber(asymptoticSpeedMps / 1_000, 2)} km/s`}.
        </p>
      </div>
    </section>
  );
}
