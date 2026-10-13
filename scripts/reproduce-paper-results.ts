import { pathToFileURL } from "node:url";
import { orbitalEnergy } from "@/lib/physics/orbital";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import { defaultMission } from "@/lib/state/mission-store";
import type { MissionConfig } from "@/lib/types";

const transitDistanceAu = 276_000;
const speedConversionAuPerYear = 0.2109;

export const paperResultExpectations = [
  { name: "Baseline 1", propulsionType: "Chemical Rocket", applyGravityAssists: false, peakSpeedKps: 51.191, finalVInfinityKps: 29.098, distanceAt90YearsAu: 558.6 },
  { name: "Baseline 2", propulsionType: "Chemical Rocket", applyGravityAssists: true, peakSpeedKps: 51.191, finalVInfinityKps: 29.091, distanceAt90YearsAu: 558.5 },
  { name: "Test 1", propulsionType: "Fusion Rocket", applyGravityAssists: false, peakSpeedKps: 408.076, finalVInfinityKps: 407.419, distanceAt90YearsAu: 7732.4 },
  { name: "Test 2", propulsionType: "Fusion Rocket", applyGravityAssists: true, peakSpeedKps: 408.076, finalVInfinityKps: 407.418, distanceAt90YearsAu: 7732.4 }
] as const;

export type PaperResultRow = {
  configuration: string;
  peakSpeedKps: number;
  finalVInfinityKps: number;
  distanceAt90YearsAu: number;
  deltaVKps: number;
  fuelRemainingKg: number;
  estimatedTransitYears: number;
};

export function reproducePaperResults(): PaperResultRow[] {
  return paperResultExpectations.map((configuration) => {
    const mission: MissionConfig = {
      ...defaultMission,
      id: `paper-reproduction-${configuration.name.toLowerCase().replaceAll(" ", "-")}`,
      missionName: configuration.name,
      launchBody: "Earth",
      destination: "Alpha Centauri",
      launchDate: "2048-07-16",
      propulsionType: configuration.propulsionType,
      payloadMassKg: 1_200,
      fuelMassKg: 8_500,
      initialVelocityMps: 42_000,
      maxAccelerationMps2: 0.18,
      maxMissionDurationYears: 90,
      integrator: "RK4",
      gravityAssists: [{ planetName: "Jupiter", flybyOrder: 1, closestApproachKm: 540_000 }],
      applyGravityAssists: configuration.applyGravityAssists,
      propulsionSettings: {}
    };
    const result = runTrajectorySimulation(mission, 950);
    const finalStep = result.simulationData.at(-1)!;
    const finalEnergy = orbitalEnergy(finalStep.position, finalStep.velocity);
    const finalVInfinityKps = Math.sqrt(2 * finalEnergy) / 1_000;

    return {
      configuration: configuration.name,
      peakSpeedKps: result.maxVelocityKps,
      finalVInfinityKps,
      distanceAt90YearsAu: result.totalDistanceAu,
      deltaVKps: result.deltaVKps,
      fuelRemainingKg: result.fuelRemainingKg,
      estimatedTransitYears: transitDistanceAu / (finalVInfinityKps * speedConversionAuPerYear)
    };
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.table(
    reproducePaperResults().map((row) => ({
      ...row,
      peakSpeedKps: row.peakSpeedKps.toFixed(3),
      finalVInfinityKps: row.finalVInfinityKps.toFixed(3),
      distanceAt90YearsAu: row.distanceAt90YearsAu.toFixed(1),
      deltaVKps: row.deltaVKps.toFixed(3),
      fuelRemainingKg: row.fuelRemainingKg.toFixed(3),
      estimatedTransitYears: row.estimatedTransitYears.toFixed(2)
    }))
  );
}
