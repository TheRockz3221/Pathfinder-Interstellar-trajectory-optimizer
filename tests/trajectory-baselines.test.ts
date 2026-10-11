import { describe, expect, it } from "vitest";
import { AU_M, YEAR_S, celestialBodies } from "@/lib/constants/celestial-bodies";
import { bodyPositionAtTime, bodyVelocityAtTime, distance, magnitude, orbitalEnergy, subtract } from "@/lib/physics/orbital";
import { closestApproachToBody, closestApproachTimeYears, scanJupiterLaunchWindow } from "@/lib/physics/launch-window";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import { defaultMission } from "@/lib/state/mission-store";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";

const assistPlan = [{ planetName: "Jupiter", flybyOrder: 1, closestApproachKm: 540_000 }] as const;
const monitoredPlanets = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"] as const;
const closeApproachLimitM = 0.05 * AU_M;

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

function interpolateStep(result: TrajectoryResult, elapsedSeconds: number) {
  const steps = result.simulationData;
  const upperIndex = steps.findIndex((step) => step.elapsedSeconds >= elapsedSeconds);
  if (upperIndex <= 0) return steps[Math.max(upperIndex, 0)];
  const start = steps[upperIndex - 1];
  const end = steps[upperIndex];
  const fraction = (elapsedSeconds - start.elapsedSeconds) / (end.elapsedSeconds - start.elapsedSeconds);
  const interpolateVector = (a: typeof start.position, b: typeof end.position) => ({
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
    z: a.z + (b.z - a.z) * fraction
  });
  return {
    ...start,
    elapsedSeconds,
    position: interpolateVector(start.position, end.position),
    velocity: interpolateVector(start.velocity, end.velocity)
  };
}

function yearlyEnergyReport(result: TrajectoryResult) {
  const initialEnergy = orbitalEnergy(result.simulationData[0].position, result.simulationData[0].velocity);
  const rows = Array.from({ length: 91 }, (_, year) => {
    const step = interpolateStep(result, year * YEAR_S);
    const energyJkg = orbitalEnergy(step.position, step.velocity);
    return {
      year,
      specificEnergyJkg: energyJkg,
      changeFromLaunchPercent: ((energyJkg - initialEnergy) / Math.abs(initialEnergy)) * 100
    };
  });
  return rows;
}

function closeApproachReport(result: TrajectoryResult, launchDate: string) {
  const encounters: {
    body: string;
    timeYears: number;
    distanceKm: number;
    relativeSpeedKps: number;
  }[] = [];

  for (const bodyName of monitoredPlanets) {
    let activeEncounter: (typeof encounters)[number] | undefined;
    for (let index = 0; index < result.simulationData.length - 1; index++) {
      const start = result.simulationData[index];
      const end = result.simulationData[index + 1];
      const relativeStart = subtract(start.position, bodyPositionAtTime(bodyName, start.elapsedSeconds, launchDate));
      const relativeEnd = subtract(end.position, bodyPositionAtTime(bodyName, end.elapsedSeconds, launchDate));
      const relativeDelta = subtract(relativeEnd, relativeStart);
      const deltaSquared = relativeDelta.x ** 2 + relativeDelta.y ** 2 + relativeDelta.z ** 2;
      const fraction =
        deltaSquared > 0
          ? Math.min(1, Math.max(0, -(relativeStart.x * relativeDelta.x + relativeStart.y * relativeDelta.y + relativeStart.z * relativeDelta.z) / deltaSquared))
          : 0;
      const closestRelative = {
        x: relativeStart.x + relativeDelta.x * fraction,
        y: relativeStart.y + relativeDelta.y * fraction,
        z: relativeStart.z + relativeDelta.z * fraction
      };
      const distanceM = magnitude(closestRelative);
      if (distanceM > closeApproachLimitM) {
        activeEncounter = undefined;
        continue;
      }

      const elapsedSeconds = start.elapsedSeconds + (end.elapsedSeconds - start.elapsedSeconds) * fraction;
      const probeVelocity = {
        x: start.velocity.x + (end.velocity.x - start.velocity.x) * fraction,
        y: start.velocity.y + (end.velocity.y - start.velocity.y) * fraction,
        z: start.velocity.z + (end.velocity.z - start.velocity.z) * fraction
      };
      const relativeSpeedMps = magnitude(
        subtract(probeVelocity, bodyVelocityAtTime(bodyName, elapsedSeconds, launchDate))
      );
      if (!activeEncounter || elapsedSeconds - activeEncounter.timeYears * YEAR_S > 60 * 86_400) {
        activeEncounter = {
          body: bodyName,
          timeYears: elapsedSeconds / YEAR_S,
          distanceKm: distanceM / 1_000,
          relativeSpeedKps: relativeSpeedMps / 1_000
        };
        encounters.push(activeEncounter);
      } else if (distanceM / 1_000 < activeEncounter.distanceKm) {
        activeEncounter.timeYears = elapsedSeconds / YEAR_S;
        activeEncounter.distanceKm = distanceM / 1_000;
        activeEncounter.relativeSpeedKps = relativeSpeedMps / 1_000;
      }
    }
  }
  return encounters.sort((a, b) => a.timeYears - b.timeYears);
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
    const bodyRadiusKm = celestialBodies[assist.planetName].radiusKm;
    const closestDistanceKm = closest.distanceM / 1_000;
    return {
      body: assist.planetName,
      encounter:
        closestDistanceKm < bodyRadiusKm
          ? "Impact/invalid flyby"
          : !mission.applyGravityAssists
            ? "Assist disabled"
            : "No encounter",
      encounterTimeYears: null,
      closestApproachTimeYears: closestApproachTimeYears(closest),
      closestApproachDistanceKm: closestDistanceKm,
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
    const chemicalScanMission = { ...createMission("Chemical Rocket", false), maxMissionDurationYears: 10 };
    const fusionScanMission = { ...createMission("Fusion Rocket", false), maxMissionDurationYears: 2 };
    const [chemicalLaunchWindow, fusionLaunchWindow] = [
      scanJupiterLaunchWindow(chemicalScanMission, 950),
      scanJupiterLaunchWindow(fusionScanMission, 950)
    ];
    const noEncounterThresholdKm =
      celestialBodies.Jupiter.radiusKm + assistPlan[0].closestApproachKm + 3 * celestialBodies.Jupiter.radiusKm;
    const scanReport = (propulsionType: MissionConfig["propulsionType"], scan: ReturnType<typeof scanJupiterLaunchWindow>) => ({
      propulsionType,
      launchDate: scan.launchDate,
      offsetDays: scan.dateOffsetDays,
      candidatesScanned: scan.candidatesScanned,
      dailyCandidatesScanned: scan.dailyCandidatesScanned,
      hourlyCandidatesScanned: scan.hourlyCandidatesScanned,
      minuteCandidatesScanned: scan.minuteCandidatesScanned,
      secondCandidatesScanned: scan.secondCandidatesScanned,
      synodicPeriodDays,
      scanHorizonYears: scan.scanHorizonYears,
      closestApproachTimeYears: closestApproachTimeYears(scan),
      closestApproachDistanceKm: scan.distanceM / 1_000,
      relativeVInfinityKps: scan.relativeSpeedMps / 1_000,
      noEncounterThresholdKm
    });
    console.log("Per-config Jupiter launch-window scans", [
      scanReport("Chemical Rocket", chemicalLaunchWindow),
      scanReport("Fusion Rocket", fusionLaunchWindow)
    ]);
    expect(Math.abs(chemicalLaunchWindow.distanceM / 1_000 - (celestialBodies.Jupiter.radiusKm + assistPlan[0].closestApproachKm))).toBeLessThan(1_000);
    if (fusionLaunchWindow.distanceM / 1_000 > noEncounterThresholdKm) {
      console.log("Fusion two-year launch scan misses the Jupiter assist threshold", {
        distanceKm: fusionLaunchWindow.distanceM / 1_000,
        thresholdKm: noEncounterThresholdKm
      });
    }

    const diagnosticMission = createMission("Chemical Rocket", false, "2049-03-12");
    const diagnosticResult = runTrajectorySimulation(diagnosticMission, 950);
    const yearlyEnergy = yearlyEnergyReport(diagnosticResult);
    const closeApproaches = closeApproachReport(diagnosticResult, diagnosticMission.launchDate);
    console.log("Chemical baseline yearly Sun-specific energy, assists off, 2049-03-12", yearlyEnergy);
    console.log("Chemical baseline approaches within 0.05 AU, assists off, 2049-03-12", closeApproaches);

    const scenarios = [
      { label: "Baseline 1", mission: createMission("Chemical Rocket", false, chemicalLaunchWindow.launchDate) },
      { label: "Baseline 2", mission: createMission("Chemical Rocket", true, chemicalLaunchWindow.launchDate) },
      { label: "Test 1", mission: createMission("Fusion Rocket", false, fusionLaunchWindow.launchDate) },
      { label: "Test 2", mission: createMission("Fusion Rocket", true, fusionLaunchWindow.launchDate) }
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
    }
    expect(chemicalLaunchWindow.distanceM / 1_000).toBeLessThan(noEncounterThresholdKm);
    expect(fusionLaunchWindow.dailyCandidatesScanned).toBe(399);
    expect(chemicalLaunchWindow.dailyCandidatesScanned).toBe(399);
    for (const scan of [fusionLaunchWindow, chemicalLaunchWindow]) {
      expect(scan.hourlyCandidatesScanned).toBeGreaterThan(0);
      expect(scan.minuteCandidatesScanned).toBeGreaterThan(0);
      expect(scan.secondCandidatesScanned).toBeGreaterThan(0);
      expect(scan.candidatesScanned).toBe(
        scan.dailyCandidatesScanned +
          scan.hourlyCandidatesScanned +
          scan.minuteCandidatesScanned +
          scan.secondCandidatesScanned
      );
    }
    expect(yearlyEnergy).toHaveLength(91);
    expect(closeApproaches.every((encounter) => encounter.distanceKm <= closeApproachLimitM / 1_000)).toBe(true);
    for (const result of solarCoastResults) {
      expect(energyCoastDrift(result).percent).toBeLessThan(0.1);
    }
    expect(results[0].mission.launchDate).toBe(results[1].mission.launchDate);
    expect(results[0].mission.launchDate).toBe(chemicalLaunchWindow.launchDate);
    expect(results[0].mission.initialVelocityMps).toBe(results[1].mission.initialVelocityMps);
    expect(results[0].result.simulationData[0].position).toEqual(results[1].result.simulationData[0].position);
    expect(results[0].result.simulationData[0].velocity).toEqual(results[1].result.simulationData[0].velocity);
    expect(results[0].result.simulationData).not.toEqual(results[1].result.simulationData);
    expect(results[2].mission.launchDate).toBe(results[3].mission.launchDate);
    expect(results[2].mission.launchDate).toBe(fusionLaunchWindow.launchDate);
    expect(results[2].mission.initialVelocityMps).toBe(results[3].mission.initialVelocityMps);
    expect(Number.isFinite(results[2].result.optimizationScore)).toBe(true);
    expect(Number.isFinite(results[0].result.optimizationScore)).toBe(true);
    expect(results[2].result.simulationData[0].position).toEqual(results[3].result.simulationData[0].position);
    expect(results[2].result.simulationData[0].velocity).toEqual(results[3].result.simulationData[0].velocity);
    expect(results[2].result.simulationData).not.toEqual(results[3].result.simulationData);
  });
});
