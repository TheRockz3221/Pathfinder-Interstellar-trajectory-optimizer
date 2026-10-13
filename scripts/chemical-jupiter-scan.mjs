import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};

Module._extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.Node10
    },
    fileName: filename
  });
  module._compile(outputText, filename);
};

const orbital = require(path.join(projectRoot, "lib", "physics", "orbital.ts"));
const originalBodyVelocityAtTime = orbital.bodyVelocityAtTime;
let activeLaunchDate = "";
let activeLaunchAngleDeg = 0;

orbital.bodyVelocityAtTime = (bodyName, elapsedSeconds, launchDate) => {
  const velocity = originalBodyVelocityAtTime(bodyName, elapsedSeconds, launchDate);
  if (bodyName !== "Earth" || elapsedSeconds !== 0 || launchDate !== activeLaunchDate) {
    return velocity;
  }
  const angle = (activeLaunchAngleDeg * Math.PI) / 180;
  return {
    x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
    y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle),
    z: velocity.z
  };
};

const { runTrajectorySimulation } = require(
  path.join(projectRoot, "lib", "physics", "simulation.ts")
);
const { DAY_S, G, YEAR_S, celestialBodies } = require(
  path.join(projectRoot, "lib", "constants", "celestial-bodies.ts")
);
const { bodyPositionAtTime, bodyVelocityAtTime, magnitude } = orbital;

const CENTER_DATE = "2048-07-16T00:00:00.000Z";
const PERIOD_DAYS = celestialBodies.Jupiter.orbitalPeriodDays;
const LAUNCH_SPACING_DAYS = 30;
const HALF_SPAN_DAYS = Math.floor(PERIOD_DAYS / (2 * LAUNCH_SPACING_DAYS)) * LAUNCH_SPACING_DAYS;
const PERIAPSIS_ALTITUDE_KM = 540_000;
const JUPITER_RADIUS_KM = celestialBodies.Jupiter.radiusKm;
const targetCenterDistanceM = (JUPITER_RADIUS_KM + PERIAPSIS_ALTITUDE_KM) * 1_000;
const centerTimestamp = Date.parse(CENTER_DATE);

const missionTemplate = {
  id: "chemical-jupiter-launch-window-analysis",
  missionName: "Chemical Jupiter Launch Window Analysis",
  launchBody: "Earth",
  destination: "Alpha Centauri",
  launchDate: CENTER_DATE,
  propulsionType: "Chemical Rocket",
  payloadMassKg: 1_200,
  fuelMassKg: 8_500,
  initialVelocityMps: 42_000,
  maxAccelerationMps2: 0.18,
  maxMissionDurationYears: 90,
  optimizationMethod: "Differential Evolution",
  integrator: "RK4",
  gravityAssists: [{ planetName: "Jupiter", flybyOrder: 1, closestApproachKm: PERIAPSIS_ALTITUDE_KM }],
  applyGravityAssists: true,
  objectiveWeights: { travelTime: 70, fuel: 15, safety: 10, deltaV: 5 },
  propulsionSettings: {}
};

function closestApproach(steps, launchDate) {
  let best;
  for (let index = 0; index < steps.length; index += 1) {
    const start = steps[index];
    const end = steps[index + 1] ?? start;
    const jupiterStart = bodyPositionAtTime("Jupiter", start.elapsedSeconds, launchDate);
    const jupiterEnd = bodyPositionAtTime("Jupiter", end.elapsedSeconds, launchDate);
    const relativeStart = subtract(start.position, jupiterStart);
    const relativeEnd = subtract(end.position, jupiterEnd);
    const relativeDelta = subtract(relativeEnd, relativeStart);
    const deltaSquared = dot(relativeDelta, relativeDelta);
    const fraction = deltaSquared > 0
      ? Math.min(1, Math.max(0, -dot(relativeStart, relativeDelta) / deltaSquared))
      : 0;
    const relativePosition = add(relativeStart, scale(relativeDelta, fraction));
    const distanceM = magnitude(relativePosition);
    if (!best || distanceM < best.distanceM) {
      best = {
        distanceM,
        elapsedSeconds: start.elapsedSeconds + (end.elapsedSeconds - start.elapsedSeconds) * fraction,
        segmentIndex: index,
        fraction
      };
    }
  }
  if (!best) throw new Error("The simulation returned no trajectory samples.");
  return best;
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(vector, factor) {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function runCandidate(launchDate, launchAngleDeg) {
  activeLaunchDate = launchDate;
  activeLaunchAngleDeg = launchAngleDeg;
  const mission = { ...missionTemplate, launchDate };
  const trajectory = runTrajectorySimulation(mission);
  const approach = closestApproach(trajectory.simulationData, launchDate);
  return {
    launchDate,
    launchAngleDeg,
    distanceM: approach.distanceM,
    periapsisAltitudeKm: approach.distanceM / 1_000 - JUPITER_RADIUS_KM,
    approach,
    trajectory
  };
}

function formatDistance(km) {
  return `${km.toLocaleString("en-US", { maximumFractionDigits: 1 })} km`;
}

function formatSpeed(kmPerSecond) {
  return `${kmPerSecond.toFixed(3)} km/s`;
}

function stateAtEncounterSide(step, launchDate) {
  const jupiterPosition = bodyPositionAtTime("Jupiter", step.elapsedSeconds, launchDate);
  const jupiterVelocity = bodyVelocityAtTime("Jupiter", step.elapsedSeconds, launchDate);
  const relativePosition = subtract(step.position, jupiterPosition);
  const relativeVelocity = subtract(step.velocity, jupiterVelocity);
  const radiusM = Math.max(magnitude(relativePosition), 1);
  const relativeSpeedMps = magnitude(relativeVelocity);
  const jupiterMu = G * celestialBodies.Jupiter.massKg;
  const energyTerm = relativeSpeedMps ** 2 - (2 * jupiterMu) / radiusM;
  return {
    elapsedSeconds: step.elapsedSeconds,
    vInfinityMps: energyTerm > 0 ? Math.sqrt(energyTerm) : undefined,
    heliocentricSpeedMps: magnitude(step.velocity)
  };
}

function formatElapsedDate(launchDate, elapsedSeconds) {
  return new Date(Date.parse(launchDate) + elapsedSeconds * 1_000).toISOString();
}

function printFlybyDetail(candidate) {
  const { trajectory, approach, launchDate } = candidate;
  const steps = trajectory.simulationData;
  let beforeIndex = -1;
  let afterIndex = -1;
  for (let index = 0; index < steps.length; index += 1) {
    if (steps[index].elapsedSeconds < approach.elapsedSeconds) beforeIndex = index;
    if (steps[index].elapsedSeconds > approach.elapsedSeconds) {
      afterIndex = index;
      break;
    }
  }
  if (beforeIndex < 0) beforeIndex = Math.max(0, approach.segmentIndex);
  if (afterIndex < 0) afterIndex = Math.min(steps.length - 1, approach.segmentIndex + 1);

  const before = stateAtEncounterSide(steps[beforeIndex], launchDate);
  const after = stateAtEncounterSide(steps[afterIndex], launchDate);
  const encounterDate = formatElapsedDate(launchDate, approach.elapsedSeconds);
  const incoming = before.vInfinityMps === undefined
    ? "not hyperbolic at the pre-encounter sample"
    : formatSpeed(before.vInfinityMps / 1_000);
  const outgoing = after.vInfinityMps === undefined
    ? "not hyperbolic at the post-encounter sample"
    : formatSpeed(after.vInfinityMps / 1_000);

  console.log("\nClosest overall candidate flyby detail");
  console.log(`  Launch: ${launchDate} (prograde offset ${candidate.launchAngleDeg >= 0 ? "+" : ""}${candidate.launchAngleDeg}°)`);
  console.log(`  Encounter: ${encounterDate} UTC (${(approach.elapsedSeconds / YEAR_S).toFixed(3)} years after launch)`);
  console.log(`  Minimum Jupiter center distance: ${formatDistance(approach.distanceM / 1_000)}`);
  console.log(`  Periapsis altitude: ${formatDistance(candidate.periapsisAltitudeKm)}`);
  console.log(`  Jupiter-relative v∞ in: ${incoming}`);
  console.log(`  Jupiter-relative v∞ out: ${outgoing}`);
  console.log(`  Heliocentric speed before: ${formatSpeed(before.heliocentricSpeedMps / 1_000)} at ${formatElapsedDate(launchDate, before.elapsedSeconds)}`);
  console.log(`  Heliocentric speed after: ${formatSpeed(after.heliocentricSpeedMps / 1_000)} at ${formatElapsedDate(launchDate, after.elapsedSeconds)}`);
}

const launchCandidates = [];
console.log("Per-date minimum probe-to-Jupiter distances:");
for (let offsetDays = -HALF_SPAN_DAYS; offsetDays <= HALF_SPAN_DAYS; offsetDays += LAUNCH_SPACING_DAYS) {
  const launchDate = new Date(centerTimestamp + offsetDays * DAY_S * 1_000).toISOString();
  const candidate = runCandidate(launchDate, 0);
  launchCandidates.push(candidate);
  console.log(
    `  ${launchDate.slice(0, 10)} — ${formatDistance(candidate.distanceM / 1_000)} center distance; ${formatDistance(candidate.periapsisAltitudeKm)} altitude`
  );
}

const sortedCandidates = [...launchCandidates].sort((a, b) => a.distanceM - b.distanceM);
console.log(`Chemical/Jupiter-on launch-window scan: ${launchCandidates.length} dates, every ${LAUNCH_SPACING_DAYS} days.`);
console.log(`Jupiter period: ${PERIOD_DAYS.toFixed(2)} days; symmetric scan span: ${2 * HALF_SPAN_DAYS} days centered on ${CENTER_DATE.slice(0, 10)}.`);
console.log(`Mission: 1,200 kg payload, 8,500 kg propellant, 42 km/s, 0.18 m/s², 90 years, target periapsis altitude ${PERIAPSIS_ALTITUDE_KM.toLocaleString("en-US")} km.`);
console.log("\n10 closest launch-date candidates (distance to Jupiter center):");
for (const [index, candidate] of sortedCandidates.slice(0, 10).entries()) {
  console.log(
    `${String(index + 1).padStart(2, " ")}. ${candidate.launchDate.slice(0, 10)} — ${formatDistance(candidate.distanceM / 1_000)} center distance; ${formatDistance(candidate.periapsisAltitudeKm)} altitude`
  );
}

const altitudeCandidates = sortedCandidates.filter(
  (candidate) => candidate.distanceM <= targetCenterDistanceM
);
let allFlybyCandidates = [...sortedCandidates];
if (altitudeCandidates.length === 0) {
  const bestLaunchDate = sortedCandidates[0].launchDate;
  console.log(`\nNo 30-day candidate reached the ${PERIAPSIS_ALTITUDE_KM.toLocaleString("en-US")} km target periapsis altitude.`);
  console.log(`Retrying best date ${bestLaunchDate.slice(0, 10)} at ±5° and ±10° from prograde.`);
  const angledCandidates = [-10, -5, 5, 10].map((angle) => runCandidate(bestLaunchDate, angle));
  allFlybyCandidates = [...allFlybyCandidates, ...angledCandidates];
  for (const candidate of angledCandidates) {
    console.log(
      `  ${candidate.launchAngleDeg > 0 ? "+" : ""}${candidate.launchAngleDeg}° — ${formatDistance(candidate.distanceM / 1_000)} center distance; ${formatDistance(candidate.periapsisAltitudeKm)} altitude`
    );
  }
}

const closestOverall = allFlybyCandidates.reduce(
  (best, candidate) => candidate.distanceM < best.distanceM ? candidate : best
);
console.log(
  `\nClosest result ${closestOverall.distanceM <= targetCenterDistanceM ? "meets" : "does not meet"} the specified periapsis altitude threshold (${formatDistance(targetCenterDistanceM / 1_000)} center distance).`
);
printFlybyDetail(closestOverall);
