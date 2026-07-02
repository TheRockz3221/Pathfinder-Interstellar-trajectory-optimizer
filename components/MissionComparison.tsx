"use client";

import { mutateMissionForComparison } from "@/lib/optimization/optimizer";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import type { MissionConfig } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function MissionComparison({ mission }: { mission: MissionConfig }) {
  const rows = mutateMissionForComparison(mission).map((candidate) => ({
    mission: candidate,
    result: runTrajectorySimulation(candidate, 420)
  }));

  return (
    <section className="glass rounded-lg p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Mission Comparison</h2>
        <p className="text-sm text-slate-300">Baseline versus propulsion and gravity-assist variants.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.12em] text-slate-400">
            <tr>
              <th className="px-3 py-2">Mission</th>
              <th className="px-3 py-2">Propulsion</th>
              <th className="px-3 py-2">Travel time</th>
              <th className="px-3 py-2">Fuel remaining</th>
              <th className="px-3 py-2">Delta-v</th>
              <th className="px-3 py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ mission: rowMission, result }) => (
              <tr key={rowMission.id} className="rounded-md bg-white/[0.045]">
                <td className="rounded-l-md px-3 py-3 font-medium text-white">{rowMission.missionName}</td>
                <td className="px-3 py-3 text-slate-300">{rowMission.propulsionType}</td>
                <td className="px-3 py-3 text-slate-300">{formatNumber(result.travelTimeYears, 1)} yr</td>
                <td className="px-3 py-3 text-emerald">{formatNumber(result.fuelRemainingKg, 0)} kg</td>
                <td className="px-3 py-3 text-slate-300">{formatNumber(result.deltaVKps, 2)} km/s</td>
                <td className="rounded-r-md px-3 py-3 text-gold-mission">{formatNumber(result.optimizationScore, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
