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
  dailyCandidatesScanned: number;
  hourlyCandidatesScanned: number;
  minuteCandidatesScanned: number;
  secondCandidatesScanned: number;
  scanHorizonYears: number;
};

const HOUR_MS = 60 * 60 * 1_000;
const MINUTE_MS = 60 * 1_000;

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
  const launchTimestamp = Date.parse(
    mission.launchDate.includes("T") ? mission.launchDate : `${mission.launchDate}T00:00:00Z`
  );
  if (Number.isNaN(launchTimestamp)) {
    throw new RangeError(`Invalid launch date: ${mission.launchDate}`);
  }

  const earthPeriod = celestialBodies.Earth.orbitalPeriodDays;
  const jupiterPeriod = celestialBodies.Jupiter.orbitalPeriodDays;
  const synodicPeriodDays = 1 / Math.abs(1 / earthPeriod - 1 / jupiterPeriod);
  const dailyCandidatesScanned = Math.ceil(synodicPeriodDays);
  const scanHorizonYears = mission.maxMissionDurationYears;
  const scanEndTimestamp = launchTimestamp + synodicPeriodDays * DAY_S * 1_000;
  const scannedTimestamps = new Set<number>();
  const refinementCounts = { hourly: 0, minute: 0, second: 0 };
  const assistTarget = mission.gravityAssists.find((assist) => assist.planetName === "Jupiter");
  const targetPeriapsisM =
    (celestialBodies.Jupiter.radiusKm + Math.max(assistTarget?.closestApproachKm ?? 100, 100)) * 1_000;
  let best: LaunchWindowScanResult | undefined;

  const evaluateTimestamp = (timestamp: number, stage: "daily" | "hourly" | "minute" | "second") => {
    if (timestamp < launchTimestamp || timestamp >= scanEndTimestamp || scannedTimestamps.has(timestamp)) return;
    scannedTimestamps.add(timestamp);
    if (stage !== "daily") refinementCounts[stage] += 1;
    const launchDate = new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, "Z");
    const assistOffMission = {
      ...mission,
      launchDate,
      maxMissionDurationYears: scanHorizonYears,
      applyGravityAssists: false
    };
    const trajectory = runTrajectorySimulation(assistOffMission, Math.min(requestedSteps, 120));
    const approach = closestApproachToBody(trajectory, "Jupiter", launchDate);
    if (!best || Math.abs(approach.distanceM - targetPeriapsisM) < Math.abs(best.distanceM - targetPeriapsisM)) {
      best = {
        ...approach,
        launchDate,
        dateOffsetDays: (timestamp - launchTimestamp) / (DAY_S * 1_000),
        synodicPeriodDays,
        candidatesScanned: scannedTimestamps.size,
        dailyCandidatesScanned,
        hourlyCandidatesScanned: refinementCounts.hourly,
        minuteCandidatesScanned: refinementCounts.minute,
        secondCandidatesScanned: refinementCounts.second,
        scanHorizonYears
      };
    }
  };

  for (let dateOffsetDays = 0; dateOffsetDays < dailyCandidatesScanned; dateOffsetDays++) {
    evaluateTimestamp(launchTimestamp + dateOffsetDays * DAY_S * 1_000, "daily");
  }

  if (!best) {
    throw new Error("Jupiter launch-window scan did not evaluate any daily dates.");
  }

  const refine = (stepMs: number, radiusSteps: number, stage: "hourly" | "minute" | "second") => {
    const centerTimestamp = Date.parse(best!.launchDate);
    for (let offset = -radiusSteps; offset <= radiusSteps; offset++) {
      evaluateTimestamp(centerTimestamp + offset * stepMs, stage);
    }
  };
  refine(HOUR_MS, 24, "hourly");
  refine(MINUTE_MS, 60, "minute");
  refine(1_000, 60, "second");

  if (!best) {
    throw new Error("Jupiter launch-window scan did not evaluate any dates.");
  }
  best.candidatesScanned = scannedTimestamps.size;
  best.hourlyCandidatesScanned = refinementCounts.hourly;
  best.minuteCandidatesScanned = refinementCounts.minute;
  best.secondCandidatesScanned = refinementCounts.second;
  return best;
}

export function closestApproachTimeYears(approach: ClosestApproach) {
  return approach.elapsedSeconds / YEAR_S;
}
