import { describe, expect, it } from "vitest";
import { AU_M, YEAR_S } from "@/lib/constants/celestial-bodies";
import { bodyPositionAtTime, bodyVelocityAtTime, distance, magnitude, orbitalEnergy, subtract } from "@/lib/physics/orbital";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import { defaultMission } from "@/lib/state/mission-store";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";

const assistPlan = [{ planetName: "Jupiter", flybyOrder: 1, closestApproachKm: 540_000 }] as const;

function createMission(propulsionType: MissionConfig["propulsionType"], applyGravityAssists: boolean): MissionConfig {
  return {
    ...defaultMission,
    propulsionType,
    payloadMassKg: 1_200,
    fuelMassKg: 8_500,
    initialVelocityMps: 42_000,
    maxAccelerationMps2: 0.18,
    maxMissionDurationYears: 90,
    integrator: "RK4",
    optimizationMethod: "Differential Evolution",
    objectiveWeights: { travelTime: 70, fuel: 15, safety: 10, deltaV: 5 },
    gravityAssists: [...assistPlan],
    applyGravityAssists
  };
}

function energyCoastDrift(result: TrajectoryResult) {
  const lastBurnIndex = result.simulationData.reduce(
    (lastIndex, step, index, steps) => (step.deltaVMps < steps.at(-1)!.deltaVMps - 1e-9 ? index : lastIndex),
    -1
  );
  const coastStart = Math.max(0, lastBurnIndex + 1);
  const coastEnergy = orbitalEnergy(result.simulationData[coastStart].position, result.simulationData[coastStart].velocity);
  const maximumDrift = result.simulationData.slice(coastStart).reduce((maximum, step) => {
    const energy = orbitalEnergy(step.position, step.velocity);
    const relativeDrift = Math.abs((energy - coastEnergy) / coastEnergy);
    return relativeDrift > maximum.relativeDrift
      ? { relativeDrift, elapsedSeconds: step.elapsedSeconds }
      : maximum;
  }, { relativeDrift: 0, elapsedSeconds: 0 });
  return { percent: maximumDrift.relativeDrift * 100, year: maximumDrift.elapsedSeconds / YEAR_S };
}

function assistReport(mission: MissionConfig, result: TrajectoryResult) {
  return mission.gravityAssists.map((assist) => {
    const event = result.gravityAssistEvents.find((candidate) => candidate.planetName === assist.planetName);
    if (event) {
      return {
        body: event.planetName,
        encounterTimeYears: event.elapsedSeconds / YEAR_S,
        closestApproachDistanceKm: event.detectedDistanceKm,
        relativeVInfinityKps: event.relativeSpeedMps / 1_000,
        heliocentricSpeedBeforeKps: event.incomingSpeedMps / 1_000,
        heliocentricSpeedAfterKps: event.outgoingSpeedMps / 1_000,
        deltaVGainedKps: event.velocityGainMps / 1_000
      };
    }

    const closest = result.simulationData.reduce(
      (best, step) => {
        const bodyPosition = bodyPositionAtTime(assist.planetName, step.elapsedSeconds, mission.launchDate);
        const separationM = distance(step.position, bodyPosition);
        return separationM < best.separationM
          ? { separationM, elapsedSeconds: step.elapsedSeconds, velocity: step.velocity }
          : best;
      },
      {
        separationM: Number.POSITIVE_INFINITY,
        elapsedSeconds: 0,
        velocity: result.simulationData[0].velocity
      }
    );
    const relativeSpeedMps = magnitude(
      subtract(closest.velocity, bodyVelocityAtTime(assist.planetName, closest.elapsedSeconds, mission.launchDate))
    );
    return {
      body: assist.planetName,
      encounter: "No encounter",
      closestApproachTimeYears: closest.elapsedSeconds / YEAR_S,
      closestApproachDistanceAu: closest.separationM / AU_M,
      closestApproachDistanceKm: closest.separationM / 1_000,
      relativeSpeedAtClosestKps: relativeSpeedMps / 1_000,
      heliocentricSpeedBeforeKps: null,
      heliocentricSpeedAfterKps: null,
      deltaVGainedKps: null
    };
  });
}

describe("requested 90-year mission baselines", () => {
  it("runs chemistry/fusion with the same on/off assist setup and prints verified metrics", () => {
    const scenarios = [
      { label: "Baseline 1", mission: createMission("Chemical Rocket", false) },
      { label: "Baseline 2", mission: createMission("Chemical Rocket", true) },
      { label: "Test 1", mission: createMission("Fusion Rocket", false) },
      { label: "Test 2", mission: createMission("Fusion Rocket", true) }
    ];
    const results = scenarios.map(({ label, mission }) => ({
      label,
      mission,
      result: runTrajectorySimulation(mission, 950)
    }));
    const solarCoastResults = results.map(({ mission }) =>
      runTrajectorySimulation({ ...mission, applyGravityAssists: false }, 950, { gravityBodies: ["Sun"] })
    );
    const rows = results.map(({ label, result }, index) => {
      const final = result.simulationData.at(-1)!;
      const finalEnergy = orbitalEnergy(final.position, final.velocity);
      return {
        case: label,
        peakSpeedKps: result.maxVelocityKps,
        finalVInfinityKps: finalEnergy > 0 ? Math.sqrt(2 * finalEnergy) / 1_000 : null,
        distanceAt90YearsAu: result.totalDistanceAu,
        deltaVKps: result.deltaVKps,
        fuelRemainingKg: result.fuelRemainingKg,
        score: result.optimizationScore,
        flybysApplied: result.gravityAssistEvents.map((event) => event.planetName).join(", ") || "None",
        nBodySunSpecificEnergyDriftPercent: energyCoastDrift(result).percent,
        sunOnlyCoastEnergyDriftPercent: energyCoastDrift(solarCoastResults[index]).percent
      };
    });
    const assistReports = results
      .filter(({ mission }) => mission.applyGravityAssists)
      .flatMap(({ label, mission, result }) => [{ run: label, ...assistReport(mission, result)[0] }]);
    console.log("90-year mission results", rows);
    console.log("assist encounter details", assistReports);

    for (const { mission, result } of results) {
      expect(result.travelTimeYears).toBeCloseTo(90, 5);
      expect(result.fuelRemainingKg).toBeGreaterThanOrEqual(0);
      expect(result.fuelRemainingKg).toBeLessThanOrEqual(mission.fuelMassKg);
    }
    for (const result of solarCoastResults) {
      expect(energyCoastDrift(result).percent).toBeLessThan(0.1);
    }
    expect(results[0].mission.launchDate).toBe(results[1].mission.launchDate);
    expect(results[0].mission.initialVelocityMps).toBe(results[1].mission.initialVelocityMps);
    if (results[1].result.gravityAssistEvents.length === 0) {
      expect(results[0].result.simulationData).toEqual(results[1].result.simulationData);
    }
    expect(results[2].mission.launchDate).toBe(results[3].mission.launchDate);
    expect(results[2].mission.initialVelocityMps).toBe(results[3].mission.initialVelocityMps);
    if (results[3].result.gravityAssistEvents.length === 0) {
      expect(results[2].result.simulationData).toEqual(results[3].result.simulationData);
    }
  });
});
