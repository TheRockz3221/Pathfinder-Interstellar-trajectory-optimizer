import type { MissionConfig, OptimizationRun } from "@/lib/types";
import { runTrajectorySimulation } from "@/lib/physics/simulation";

export function runOptimizationPreview(mission: MissionConfig, generations = 32): OptimizationRun[] {
  const runs: OptimizationRun[] = [];
  const baseline = runTrajectorySimulation(mission, 260);

  for (let generation = 1; generation <= generations; generation++) {
    const exploration = Math.exp(-generation / generations);
    const learning = 1 - exploration;
    const score = Math.min(
      99.2,
      baseline.optimizationScore + learning * 18 + Math.sin(generation * 0.9) * exploration * 4
    );
    const travelTimeYears = Math.max(
      baseline.travelTimeYears * 0.72,
      baseline.travelTimeYears * (1 - learning * 0.19 + exploration * 0.04)
    );
    const fuelUsedKg = Math.min(
      mission.fuelMassKg,
      (mission.fuelMassKg - baseline.fuelRemainingKg) * (1 - learning * 0.16)
    );

    runs.push({
      algorithm: mission.optimizationMethod,
      generation,
      score,
      travelTimeYears,
      fuelUsedKg
    });
  }

  return runs;
}

export function mutateMissionForComparison(mission: MissionConfig): MissionConfig[] {
  return [
    mission,
    {
      ...mission,
      id: `${mission.id}-fusion`,
      missionName: `${mission.missionName} Fusion Variant`,
      propulsionType: "Fusion Rocket",
      maxAccelerationMps2: Math.max(mission.maxAccelerationMps2, 0.12)
    },
    {
      ...mission,
      id: `${mission.id}-jupiter`,
      missionName: `${mission.missionName} Jupiter Assist`,
      gravityAssists: [
        ...mission.gravityAssists,
        { planetName: "Jupiter", flybyOrder: mission.gravityAssists.length + 1, closestApproachKm: 520_000 }
      ]
    }
  ];
}
