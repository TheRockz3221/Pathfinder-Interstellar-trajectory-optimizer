"use client";

import type { MissionConfig, TrajectoryResult } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export type RecentMissionRun = {
  id: string;
  mission: MissionConfig;
  result: TrajectoryResult;
  capturedAt: string;
};

export function MissionComparison({ runs }: { runs: RecentMissionRun[] }) {
  if (runs.length === 0) {
    return (
      <section className="panel min-w-0 p-4">
        <h2 className="text-base font-semibold text-white">Mission Comparison</h2>
        <div className="mt-4 rounded-md border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">
          No recent runs yet. Configure a mission to add its simulation to this session’s comparison.
        </div>
      </section>
    );
  }

  return (
    <section className="panel min-w-0 p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Recent Mission Runs</h2>
        <p className="text-sm leading-6 text-slate-300">Latest {runs.length} simulations from this session, available without login.</p>
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {runs.map(({ id, mission, result, capturedAt }) => (
          <article key={id} className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-3">
            <h3 className="break-words text-sm font-semibold text-white">{mission.missionName}</h3>
            <p className="mt-1 break-words text-xs text-slate-400">
              {mission.propulsionType} · {mission.applyGravityAssists ? "assists on" : "assists off"} · {new Date(capturedAt).toLocaleString()}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Metric label="Simulated window" value={`${formatNumber(result.travelTimeYears, 1)} yr`} />
              <Metric label="Peak speed" value={`${formatNumber(result.maxVelocityKps, 1)} km/s`} />
              <Metric label="Fuel remaining" value={`${formatNumber(result.fuelRemainingKg, 0)} kg`} />
              <Metric label="Delta-v" value={`${formatNumber(result.deltaVKps, 2)} km/s`} />
              <Metric label="Score" value={formatNumber(result.optimizationScore, 1)} />
              <Metric label="Flybys applied" value={result.gravityAssistEvents.map((event) => event.planetName).join(", ") || "None"} />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-white/[0.06] p-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-100">{value}</dd>
    </div>
  );
}
