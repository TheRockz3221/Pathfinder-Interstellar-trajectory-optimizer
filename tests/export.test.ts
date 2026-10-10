import { describe, expect, it } from "vitest";
import { exportSimulationCsv } from "@/lib/export/report";
import { defaultMission } from "@/lib/state/mission-store";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import { magnitude, rocketEquationDeltaV } from "@/lib/physics/orbital";

describe("simulation CSV export", () => {
  it("exports the computed telemetry time series as downloadable CSV fields", () => {
    const result = runTrajectorySimulation(defaultMission, 120);
    const csv = exportSimulationCsv(defaultMission, result);
    const lines = csv.split("\n");
    const firstStep = result.simulationData[0];
    const totalDeltaVMps = rocketEquationDeltaV(
      defaultMission.propulsionType,
      defaultMission.payloadMassKg,
      defaultMission.fuelMassKg,
      defaultMission.propulsionSettings.specificImpulseS
    );

    expect(lines[0]).toBe("time_seconds,heliocentric_distance_m,speed_mps,delta_v_remaining_mps,fuel_remaining_kg");
    expect(lines).toHaveLength(result.simulationData.length + 1);
    expect(lines[1]).toBe(
      [
        firstStep.elapsedSeconds,
        firstStep.distanceFromSunM,
        magnitude(firstStep.velocity),
        Math.max(0, totalDeltaVMps - firstStep.deltaVMps),
        firstStep.fuelRemainingKg
      ].join(",")
    );
  });

  it("keeps fuel and delta-v telemetry evolving during the burn instead of flattening at t=0", () => {
    const result = runTrajectorySimulation(defaultMission, 120);
    const fuelSeries = result.simulationData.map((step) => step.fuelRemainingKg);
    const deltaVSeries = result.simulationData.map((step) => step.deltaVMps);

    expect(fuelSeries[0]).toBe(defaultMission.fuelMassKg);
    expect(deltaVSeries[0]).toBe(0);
    expect(fuelSeries.some((fuel) => fuel > 0 && fuel < defaultMission.fuelMassKg)).toBe(true);
    expect(deltaVSeries.some((deltaV) => deltaV > 0 && deltaV < result.deltaVKps * 1_000)).toBe(true);
    expect(fuelSeries.at(-1)).toBeLessThan(defaultMission.fuelMassKg);
    expect(deltaVSeries.at(-1)).toBeGreaterThan(0);
  });
});
