import { DAY_S, YEAR_S, celestialBodies } from "@/lib/constants/celestial-bodies";
import type { CelestialBodyName, MissionConfig, TrajectoryResult } from "@/lib/types";
import { bodyPositionAtTime, bodyVelocityAtTime, magnitude, subtract } from "@/lib/physics/orbital";
import { runTrajectorySimulation } from "@/lib/physics/simulation";

export type ClosestApproach = {
  elapsedSeconds: number;
  distanceM: number;
  relativeSpeedMps: number;
};

export type LaunchWindowScanResult = ClosestApproach & {
  launchDate: string;
  dateOffsetDays: number;
  synodicPeriodDays: number;
  candidatesScanned: number;
  scanHorizonYears: number;
};

export function closestApproachToBody(
  result: TrajectoryResult,
  bodyName: CelestialBodyName,
  launchDate: string
): ClosestApproach {
  const steps = result.simulationData;
  if (steps.length === 0) {
    throw new RangeError("Cannot find closest approach for an empty trajectory.");
  }

  let closest: ClosestApproach | undefined;
  for (let index = 0; index < steps.length; index++) {
    const start = steps[index];
    const end = steps[index + 1] ?? start;
    const relativeStart = subtract(start.position, bodyPositionAtTime(bodyName, start.elapsedSeconds, launchDate));
    const relativeEnd = subtract(end.position, bodyPositionAtTime(bodyName, end.elapsedSeconds, launchDate));
    const relativeDelta = subtract(relativeEnd, relativeStart);
    const deltaSquared = relativeDelta.x ** 2 + relativeDelta.y ** 2 + relativeDelta.z ** 2;
    const fraction =
      deltaSquared > 0
        ? Math.min(1, Math.max(0, -(relativeStart.x * relativeDelta.x + relativeStart.y * relativeDelta.y + relativeStart.z * relativeDelta.z) / deltaSquared))
        : 0;
    const elapsedSeconds = start.elapsedSeconds + (end.elapsedSeconds - start.elapsedSeconds) * fraction;
    const relativePosition = {
      x: relativeStart.x + relativeDelta.x * fraction,
      y: relativeStart.y + relativeDelta.y * fraction,
      z: relativeStart.z + relativeDelta.z * fraction
    };
    const distanceM = magnitude(relativePosition);
    if (!closest || distanceM < closest.distanceM) {
      const probeVelocity = {
        x: start.velocity.x + (end.velocity.x - start.velocity.x) * fraction,
        y: start.velocity.y + (end.velocity.y - start.velocity.y) * fraction,
        z: start.velocity.z + (end.velocity.z - start.velocity.z) * fraction
      };
      closest = {
        elapsedSeconds,
        distanceM,
        relativeSpeedMps: magnitude(
          subtract(probeVelocity, bodyVelocityAtTime(bodyName, elapsedSeconds, launchDate))
        )
      };
    }
  }
  if (!closest) {
    throw new Error("Unable to determine closest approach.");
  }
  return closest;
}

export function scanJupiterLaunchWindow(mission: MissionConfig, requestedSteps = 950): LaunchWindowScanResult {
  const launchTimestamp = Date.parse(`${mission.launchDate}T00:00:00Z`);
  if (Number.isNaN(launchTimestamp)) {
    throw new RangeError(`Invalid launch date: ${mission.launchDate}`);
  }

  const earthPeriod = celestialBodies.Earth.orbitalPeriodDays;
  const jupiterPeriod = celestialBodies.Jupiter.orbitalPeriodDays;
  const synodicPeriodDays = 1 / Math.abs(1 / earthPeriod - 1 / jupiterPeriod);
  const candidatesScanned = Math.ceil(synodicPeriodDays);
  const scanHorizonYears = mission.maxMissionDurationYears;
  let best: LaunchWindowScanResult | undefined;

  for (let dateOffsetDays = 0; dateOffsetDays < candidatesScanned; dateOffsetDays++) {
    const launchDate = new Date(launchTimestamp + dateOffsetDays * DAY_S * 1_000).toISOString().slice(0, 10);
    const assistOffMission = {
      ...mission,
      launchDate,
      maxMissionDurationYears: scanHorizonYears,
      applyGravityAssists: false
    };
    const trajectory = runTrajectorySimulation(assistOffMission, Math.min(requestedSteps, 120));
    const approach = closestApproachToBody(trajectory, "Jupiter", launchDate);
    if (!best || approach.distanceM < best.distanceM) {
      best = {
        ...approach,
        launchDate,
        dateOffsetDays,
        synodicPeriodDays,
        candidatesScanned,
        scanHorizonYears
      };
    }
  }

  if (!best) {
    throw new Error("Jupiter launch-window scan did not evaluate any dates.");
  }
  return best;
}

export function closestApproachTimeYears(approach: ClosestApproach) {
  return approach.elapsedSeconds / YEAR_S;
}
