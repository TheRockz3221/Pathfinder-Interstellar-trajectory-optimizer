import { describe, expect, it } from "vitest";
import { YEAR_S, celestialBodies } from "@/lib/constants/celestial-bodies";
import { orbitalEnergy } from "@/lib/physics/orbital";
import { closestApproachToBody, closestApproachTimeYears, scanJupiterLaunchWindow } from "@/lib/physics/launch-window";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import { defaultMission } from "@/lib/state/mission-store";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";

const assistPlan = [{ planetName: "Jupiter", flybyOrder: 1, closestApproachKm: 540_000 }] as const;

function createMission(
  propulsionType: MissionConfig["propulsionType"],
  applyGravityAssists: boolean,
  launchDate = defaultMission.launchDate
): MissionConfig {
  return {
    ...defaultMission,
    launchDate,
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
    const closest = closestApproachToBody(result, assist.planetName, mission.launchDate);
    if (event) {
      return {
        body: event.planetName,
        encounterTimeYears: event.elapsedSeconds / YEAR_S,
        closestApproachTimeYears: closestApproachTimeYears(closest),
        closestApproachDistanceKm: event.detectedDistanceKm,
        relativeVInfinityKps: event.relativeSpeedMps / 1_000,
        heliocentricSpeedBeforeKps: event.incomingSpeedMps / 1_000,
        heliocentricSpeedAfterKps: event.outgoingSpeedMps / 1_000,
        deltaVGainedKps: event.velocityGainMps / 1_000
      };
    }
    return {
      body: assist.planetName,
      encounter: "No encounter",
      encounterTimeYears: null,
      closestApproachTimeYears: closestApproachTimeYears(closest),
      closestApproachDistanceKm: closest.distanceM / 1_000,
      relativeVInfinityKps: closest.relativeSpeedMps / 1_000,
      heliocentricSpeedBeforeKps: null,
      heliocentricSpeedAfterKps: null,
      deltaVGainedKps: null
    };
  });
}

describe("requested 90-year mission baselines", () => {
  it("runs chemistry/fusion with the same on/off assist setup and prints verified metrics", () => {
    const earthPeriodDays = celestialBodies.Earth.orbitalPeriodDays;
    const jupiterPeriodDays = celestialBodies.Jupiter.orbitalPeriodDays;
    const synodicPeriodDays = 1 / Math.abs(1 / earthPeriodDays - 1 / jupiterPeriodDays);
    const launchWindow = scanJupiterLaunchWindow(createMission("Chemical Rocket", false), 950);
    const noEncounterThresholdKm =
      celestialBodies.Jupiter.radiusKm + assistPlan[0].closestApproachKm + 3 * celestialBodies.Jupiter.radiusKm;
    console.log("Jupiter launch-window scan", {
      launchDate: launchWindow.launchDate,
      offsetDays: launchWindow.dateOffsetDays,
      candidatesScanned: launchWindow.candidatesScanned,
      synodicPeriodDays,
      scanHorizonYears: launchWindow.scanHorizonYears,
      closestApproachTimeYears: closestApproachTimeYears(launchWindow),
      closestApproachDistanceKm: launchWindow.distanceM / 1_000,
      relativeVInfinityKps: launchWindow.relativeSpeedMps / 1_000,
      noEncounterThresholdKm
    });
    const launchDate = launchWindow.launchDate;
    const scenarios = [
      { label: "Baseline 1", mission: createMission("Chemical Rocket", false, launchDate) },
      { label: "Baseline 2", mission: createMission("Chemical Rocket", true, launchDate) },
      { label: "Test 1", mission: createMission("Fusion Rocket", false, launchDate) },
      { label: "Test 2", mission: createMission("Fusion Rocket", true, launchDate) }
    ];
    const results = scenarios.map(({ label, mission }) => ({
      label,
      mission,
      result: runTrajectorySimulation(mission, 950)
    }));
    const solarCoastResults = results.map(({ mission }) =>
      runTrajectorySimulation({ ...mission, applyGravityAssists: false }, 950, { gravityBodies: ["Sun"] })
    );
    const rows = results.map(({ label, mission, result }, index) => {
      const final = result.simulationData.at(-1)!;
      const finalEnergy = orbitalEnergy(final.position, final.velocity);
      return {
        case: label,
        launchDate: mission.launchDate,
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
      .flatMap(({ label, mission, result }) => [{ run: label, ...assistReport(mission, result)[0] }]);
    console.log("90-year mission results", rows);
    console.log("assist encounter details", assistReports);

    for (const { mission, result } of results) {
      expect(result.travelTimeYears).toBeCloseTo(90, 5);
      expect(result.fuelRemainingKg).toBeGreaterThanOrEqual(0);
      expect(result.fuelRemainingKg).toBeLessThanOrEqual(mission.fuelMassKg);
      expect(result.gravityAssistEvents).toHaveLength(0);
    }
    expect(launchWindow.distanceM / 1_000).toBeGreaterThan(noEncounterThresholdKm);
    for (const result of solarCoastResults) {
      expect(energyCoastDrift(result).percent).toBeLessThan(0.1);
    }
    expect(results[0].mission.launchDate).toBe(results[1].mission.launchDate);
    expect(results[0].mission.launchDate).toBe(launchWindow.launchDate);
    expect(results[0].mission.initialVelocityMps).toBe(results[1].mission.initialVelocityMps);
    if (results[1].result.gravityAssistEvents.length === 0) {
      expect(results[0].result.simulationData).toEqual(results[1].result.simulationData);
    }
    expect(results[2].mission.launchDate).toBe(results[3].mission.launchDate);
    expect(results[2].mission.launchDate).toBe(launchWindow.launchDate);
    expect(results[2].mission.initialVelocityMps).toBe(results[3].mission.initialVelocityMps);
    expect(results[2].result.optimizationScore).toBeGreaterThan(results[0].result.optimizationScore);
    if (results[3].result.gravityAssistEvents.length === 0) {
      expect(results[2].result.simulationData).toEqual(results[3].result.simulationData);
    }
  });
});
