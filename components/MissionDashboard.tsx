"use client";

import { Gauge, Route, Timer, Zap } from "lucide-react";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type Props = {
  mission: MissionConfig;
  result: TrajectoryResult;
};

export function MissionDashboard({ mission, result }: Props) {
  const metrics = [
    { label: "Travel time", value: `${formatNumber(result.travelTimeYears, 1)} yr`, icon: Timer },
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
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Fuel remaining</p>
          <p className="break-words text-lg font-semibold text-emerald">{formatNumber(result.fuelRemainingKg, 0)} kg</p>
        </div>
        <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Gravity assists</p>
          <p className="break-words text-lg font-semibold text-white">
            {mission.gravityAssists.map((assist) => assist.planetName).join(" -> ") || "Direct"}
          </p>
        </div>
      </div>
    </section>
  );
}
