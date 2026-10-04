"use client";

import { useMemo } from "react";
import { mutateMissionForComparison } from "@/lib/optimization/optimizer";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import type { MissionConfig } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function MissionComparison({ mission }: { mission: MissionConfig }) {
  const rows = useMemo(
    () =>
      mutateMissionForComparison(mission).map((candidate) => ({
        mission: candidate,
        result: runTrajectorySimulation(candidate, 420)
      })),
    [mission]
  );

  return (
    <section className="panel min-w-0 p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Mission Comparison</h2>
        <p className="text-sm leading-6 text-slate-300">Baseline versus propulsion and gravity-assist variants.</p>
      </div>
      <div className="min-w-0">
        <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.08em] text-slate-400 sm:text-xs sm:tracking-[0.1em]">
            <tr>
              <th className="w-[18%] px-1.5 py-2 sm:px-2">Mission</th>
              <th className="w-[21%] px-1.5 py-2 sm:px-2">Propulsion</th>
              <th className="w-[15%] px-1.5 py-2 sm:px-2">Travel time</th>
              <th className="w-[18%] px-1.5 py-2 sm:px-2">Fuel remaining</th>
              <th className="w-[15%] px-1.5 py-2 sm:px-2">Delta-v</th>
              <th className="w-[13%] px-1.5 py-2 sm:px-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ mission: rowMission, result }) => (
              <tr key={rowMission.id} className="rounded-md bg-white/[0.045]">
                <td className="break-words rounded-l-md px-1.5 py-3 font-medium leading-5 text-white sm:px-2">{rowMission.missionName}</td>
                <td className="break-words px-1.5 py-3 leading-5 text-slate-300 sm:px-2">{rowMission.propulsionType}</td>
                <td className="break-words px-1.5 py-3 leading-5 text-slate-300 sm:px-2">{formatNumber(result.travelTimeYears, 1)} yr</td>
                <td className="break-words px-1.5 py-3 leading-5 text-emerald sm:px-2">{formatNumber(result.fuelRemainingKg, 0)} kg</td>
                <td className="break-words px-1.5 py-3 leading-5 text-slate-300 sm:px-2">{formatNumber(result.deltaVKps, 2)} km/s</td>
                <td className="break-words rounded-r-md px-1.5 py-3 leading-5 text-gold-mission sm:px-2">{formatNumber(result.optimizationScore, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
