import { AU_M, DAY_S, YEAR_S, celestialBodies } from "@/lib/constants/celestial-bodies";
import { propulsionModels } from "@/lib/constants/propulsion";
import type { CelestialBodyName, GravityAssistEvent, GravityAssistPlan, MissionConfig, SimulationStep, TrajectoryResult, Vector3 } from "@/lib/types";
import { leapfrogStep, rk45Step, rk4Step, type State, verletStep } from "@/lib/physics/integrators";
import {
  add,
  bodyPositionAtTime,
  bodyVelocityAtTime,
  distance,
  estimateMissionScore,
  gravityAssistVelocityGain,
  magnitude,
  nBodyAcceleration,
  normalize,
  rocketEquationDeltaV,
  scale,
  solarRadiationPressureAcceleration,
  subtract
} from "@/lib/physics/orbital";

const GRAVITY_BODIES = ["Sun", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"] as const;
const MAX_INTERNAL_STEP_SECONDS = 30 * DAY_S;
const PROPULSIVE_STEP_SECONDS = 0.5 * DAY_S;
const MIN_INTERNAL_STEP_SECONDS = 60;
const TURN_RESOLUTION = 80;
const PLANNED_ASSIST_CORRIDOR_M = 0.05 * AU_M;

type SimulationOptions = {
  gravityBodies?: readonly CelestialBodyName[];
  thrustEnabled?: boolean;
};

export function runTrajectorySimulation(
  mission: MissionConfig,
  requestedSteps = 900,
  options: SimulationOptions = {}
): TrajectoryResult {
  const origin = celestialBodies[mission.launchBody];
  const destination = celestialBodies[mission.destination];
  const model = propulsionModels[mission.propulsionType];
  const maxSteps = Math.min(Math.max(requestedSteps, 120), 120_000);
  const durationSeconds = mission.maxMissionDurationYears * YEAR_S;
  const outputStepSeconds = durationSeconds / maxSteps;
  const dryMassKg = mission.payloadMassKg;
  const gravityBodies = options.gravityBodies ?? GRAVITY_BODIES;
  const thrustEnabled = options.thrustEnabled ?? true;
  const orderedAssists = [...mission.gravityAssists].sort((a, b) => a.flybyOrder - b.flybyOrder);
  let fuelRemainingKg = mission.fuelMassKg;
  let deltaVMps = 0;
  let traveledM = 0;
  let maxVelocity = mission.initialVelocityMps;
  let elapsedSeconds = 0;
  let timestep = 0;
  let nextAssistIndex = 0;
  const launchPosition = bodyPositionAtTime(mission.launchBody, 0, mission.launchDate);
  const launchVelocity = bodyVelocityAtTime(mission.launchBody, 0, mission.launchDate);
  const launchDirection =
    magnitude(launchVelocity) > 0
      ? normalize(launchVelocity)
      : normalize(subtract(guidanceTarget(launchPosition, mission.initialVelocityMps, 0), launchPosition));
  const initialHeliocentricVelocity = scale(launchDirection, mission.initialVelocityMps);

  let state: State = {
    position: launchPosition,
    velocity: initialHeliocentricVelocity
  };

  const availableDeltaV = rocketEquationDeltaV(
    mission.propulsionType,
    dryMassKg,
    mission.fuelMassKg,
    mission.propulsionSettings.specificImpulseS
  );
  const thrustLimit = Math.min(model.accelerationLimitMps2, mission.maxAccelerationMps2);

  const steps: SimulationStep[] = [];
  const gravityAssistEvents: GravityAssistEvent[] = [];

  const accelerationFn = (position: Vector3, velocity: Vector3, elapsedSeconds: number) => {
    const gravity = nBodyAcceleration(position, [...gravityBodies], elapsedSeconds, mission.launchDate);
    const targetDirection = normalize(subtract(guidanceTarget(position, magnitude(velocity), elapsedSeconds), position));
    let thrustMagnitude =
      thrustEnabled && mission.propulsionType !== "Solar Sail" && fuelRemainingKg > 0 && deltaVMps < availableDeltaV
        ? propulsiveDeltaVRate(elapsedSeconds)
        : 0;

    if (thrustEnabled && mission.propulsionType === "Solar Sail") {
      const distanceFromSunM = Math.max(distance(position, celestialBodies.Sun.positionAtEpoch), 0.05 * AU_M);
      thrustMagnitude = solarRadiationPressureAcceleration(
        distanceFromSunM,
        mission.propulsionSettings.sailAreaM2 ?? 90_000,
        mission.propulsionSettings.reflectivity ?? 0.88,
        mission.payloadMassKg + mission.fuelMassKg
      );
    }

    const thrust = scale(targetDirection, thrustMagnitude);
    return add(gravity, thrust);
  };

  const recordStep = () => {
    const acceleration = accelerationFn(state.position, state.velocity, elapsedSeconds);
    const velocityMps = magnitude(state.velocity);
    maxVelocity = Math.max(maxVelocity, velocityMps);
    steps.push({
      timestep,
      elapsedSeconds,
      position: state.position,
      velocity: state.velocity,
      acceleration,
      distanceFromSunM: distance(state.position, bodyPositionAtTime("Sun", elapsedSeconds, mission.launchDate)),
      fuelRemainingKg,
      deltaVMps
    });
    timestep += 1;
  };

  recordStep();

  const maxTelemetrySteps = Math.min(Math.max(maxSteps * 20, maxSteps + 1), 240_000);
  while (elapsedSeconds < durationSeconds && steps.length < maxTelemetrySteps) {
    const dt = adaptiveStepSeconds(state, elapsedSeconds, durationSeconds - elapsedSeconds);
    const previousPosition = state.position;
    const previousVelocity = state.velocity;
    const stepStartSeconds = elapsedSeconds;

    state = nextState(mission, state, dt, elapsedSeconds, accelerationFn);
    elapsedSeconds += dt;
    traveledM += distance(previousPosition, state.position);

    if (thrustEnabled && mission.propulsionType !== "Solar Sail" && fuelRemainingKg > 0 && deltaVMps < availableDeltaV) {
      const burnDeltaV = Math.min(propulsiveDeltaVRate(stepStartSeconds) * dt, availableDeltaV - deltaVMps);
      const fuelUsed = mission.fuelMassKg * Math.max(0, burnDeltaV) / Math.max(availableDeltaV, 1);
      fuelRemainingKg = Math.max(0, fuelRemainingKg - fuelUsed);
      deltaVMps += Math.max(0, burnDeltaV);
    }

    if (mission.applyGravityAssists) {
      applyPendingGravityAssist(previousPosition, state.position, previousVelocity, state.velocity, stepStartSeconds, elapsedSeconds);
    }
    recordStep();

    if (distance(state.position, bodyPositionAtTime(mission.destination, elapsedSeconds, mission.launchDate)) < Math.max(destination.radiusKm * 20_000, 0.03 * AU_M)) {
      break;
    }
  }

  const travelTimeYears = steps.at(-1)!.elapsedSeconds / YEAR_S;
  const result: TrajectoryResult = {
    travelTimeYears,
    totalDistanceAu: traveledM / AU_M,
    maxVelocityKps: maxVelocity / 1_000,
    averageVelocityKps: traveledM / Math.max(steps.at(-1)!.elapsedSeconds, 1) / 1_000,
    deltaVKps: deltaVMps / 1_000,
    optimizationScore: estimateMissionScore(mission, travelTimeYears, fuelRemainingKg, deltaVMps),
    fuelRemainingKg,
    simulationData: steps,
    gravityAssistEvents
  };

  return result;

  function propulsiveDeltaVRate(elapsedSeconds: number) {
    const coastBias = Math.max(0.08, 1 - elapsedSeconds / durationSeconds);
    return thrustLimit * coastBias * model.fuelEfficiency;
  }

  function adaptiveStepSeconds(state: State, elapsedSeconds: number, remainingSeconds: number) {
    const acceleration = accelerationFn(state.position, state.velocity, elapsedSeconds);
    const speedMps = Math.max(magnitude(state.velocity), 1);
    const accelerationMps2 = magnitude(acceleration);
    const turnLimitedStep = accelerationMps2 > 0 ? speedMps / accelerationMps2 / TURN_RESOLUTION : Number.POSITIVE_INFINITY;
    const remainingDeltaVMps = Math.max(0, availableDeltaV - deltaVMps);
    const burnRateMps = propulsiveDeltaVRate(elapsedSeconds);
    const fuelLimitedStep =
      thrustEnabled && mission.propulsionType !== "Solar Sail" && fuelRemainingKg > 0 && burnRateMps > 0 && remainingDeltaVMps > 0
        ? remainingDeltaVMps / burnRateMps
        : Number.POSITIVE_INFINITY;
    const propulsiveStep =
      thrustEnabled && mission.propulsionType !== "Solar Sail" && fuelRemainingKg > 0 && remainingDeltaVMps > 0
        ? PROPULSIVE_STEP_SECONDS
        : Number.POSITIVE_INFINITY;

    return Math.max(
      MIN_INTERNAL_STEP_SECONDS,
      Math.min(outputStepSeconds, MAX_INTERNAL_STEP_SECONDS, turnLimitedStep, propulsiveStep, fuelLimitedStep, remainingSeconds)
    );
  }

  function guidanceTarget(position: Vector3, speedMps: number, elapsedSeconds: number) {
    return leadBodyPosition(mission.destination, position, speedMps, elapsedSeconds, mission.launchDate);
  }

  function applyPendingGravityAssist(
    previousPosition: Vector3,
    nextPosition: Vector3,
    previousVelocity: Vector3,
    nextVelocity: Vector3,
    startSeconds: number,
    endSeconds: number
  ) {
    const pendingAssist = orderedAssists[nextAssistIndex];
    if (!pendingAssist) {
      return;
    }

    const encounter = detectFlybyEncounter(pendingAssist, previousPosition, nextPosition, startSeconds, endSeconds, mission.launchDate);
    if (!encounter) {
      return;
    }

    const planetVelocity = bodyVelocityAtTime(pendingAssist.planetName, encounter.elapsedSeconds, mission.launchDate);
    const incomingVelocity = add(
      previousVelocity,
      scale(subtract(nextVelocity, previousVelocity), encounter.fraction)
    );
    const incomingHeliocentricSpeedMps = magnitude(incomingVelocity);
    const incomingRelativeVelocity = subtract(incomingVelocity, planetVelocity);
    const incomingRelativeSpeedMps = magnitude(incomingRelativeVelocity);
    const assist = gravityAssistVelocityGain(pendingAssist.planetName, pendingAssist.closestApproachKm, incomingRelativeSpeedMps);
    nextAssistIndex += 1;
    const impactNormal = normalize(cross(incomingRelativeVelocity, encounter.closestRelative));
    const stableNormal =
      magnitude(impactNormal) > 0
        ? impactNormal
        : normalize(cross(incomingRelativeVelocity, Math.abs(incomingRelativeVelocity.x) < Math.abs(incomingRelativeVelocity.y)
          ? { x: 1, y: 0, z: 0 }
          : { x: 0, y: 1, z: 0 }));
    let outgoingRelativeVelocity = rotateAroundAxis(incomingRelativeVelocity, stableNormal, (assist.turningAngleDeg * Math.PI) / 180);
    if (dot(outgoingRelativeVelocity, encounter.closestRelative) < 0) {
      outgoingRelativeVelocity = rotateAroundAxis(incomingRelativeVelocity, stableNormal, -(assist.turningAngleDeg * Math.PI) / 180);
    }
    state = {
      ...state,
      velocity: add(planetVelocity, outgoingRelativeVelocity)
    };

    const outgoingSpeedMps = magnitude(state.velocity);
    const appliedVelocityGainMps = outgoingSpeedMps - incomingHeliocentricSpeedMps;
    maxVelocity = Math.max(maxVelocity, outgoingSpeedMps);
    gravityAssistEvents.push({
      planetName: pendingAssist.planetName,
      flybyOrder: pendingAssist.flybyOrder,
      elapsedSeconds: encounter.elapsedSeconds,
      closestApproachKm: pendingAssist.closestApproachKm,
      detectedDistanceKm: encounter.distanceM / 1_000,
      relativeSpeedMps: incomingRelativeSpeedMps,
      incomingSpeedMps: incomingHeliocentricSpeedMps,
      velocityGainMps: appliedVelocityGainMps,
      outgoingSpeedMps
    });
  }
}

function detectFlybyEncounter(
  assist: GravityAssistPlan,
  previousPosition: Vector3,
  nextPosition: Vector3,
  startSeconds: number,
  endSeconds: number,
  launchDate: string
) {
  const body = celestialBodies[assist.planetName];
  const bodyStart = bodyPositionAtTime(assist.planetName, startSeconds, launchDate);
  const bodyEnd = bodyPositionAtTime(assist.planetName, endSeconds, launchDate);
  const relativeStart = subtract(previousPosition, bodyStart);
  const relativeEnd = subtract(nextPosition, bodyEnd);
  const relativeDelta = subtract(relativeEnd, relativeStart);
  const deltaMagnitudeSquared =
    relativeDelta.x * relativeDelta.x + relativeDelta.y * relativeDelta.y + relativeDelta.z * relativeDelta.z;
  const fraction =
    deltaMagnitudeSquared > 0
      ? Math.min(1, Math.max(0, -dot(relativeStart, relativeDelta) / deltaMagnitudeSquared))
      : 0;
  const closestRelative = add(relativeStart, scale(relativeDelta, fraction));
  const distanceM = magnitude(closestRelative);
  const periapsisM = (body.radiusKm + Math.max(assist.closestApproachKm, 100)) * 1_000;
  const sphereOfInfluenceM =
    body.semiMajorAxisAu > 0
      ? body.semiMajorAxisAu * AU_M * Math.pow(body.massKg / celestialBodies.Sun.massKg, 2 / 5)
      : periapsisM;
  const encounterRadiusM = Math.max(periapsisM * 4, sphereOfInfluenceM, PLANNED_ASSIST_CORRIDOR_M);

  if (distanceM > encounterRadiusM) {
    return null;
  }

  return {
    elapsedSeconds: startSeconds + (endSeconds - startSeconds) * fraction,
    distanceM,
    fraction,
    closestRelative
  };
}

function dot(a: Vector3, b: Vector3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function rotateAroundAxis(vector: Vector3, axis: Vector3, angleRad: number): Vector3 {
  const cosine = Math.cos(angleRad);
  const sine = Math.sin(angleRad);
  return add(
    add(scale(vector, cosine), scale(cross(axis, vector), sine)),
    scale(axis, dot(axis, vector) * (1 - cosine))
  );
}

function leadBodyPosition(
  bodyName: CelestialBodyName,
  position: Vector3,
  speedMps: number,
  elapsedSeconds: number,
  launchDate: string
) {
  const body = celestialBodies[bodyName];
  if (body.orbitalPeriodDays <= 0) {
    return bodyPositionAtTime(bodyName, elapsedSeconds, launchDate);
  }

  let interceptSeconds = elapsedSeconds;
  for (let iteration = 0; iteration < 6; iteration++) {
    const targetPosition = bodyPositionAtTime(bodyName, interceptSeconds, launchDate);
    interceptSeconds = elapsedSeconds + distance(position, targetPosition) / Math.max(speedMps, 1);
  }

  return bodyPositionAtTime(bodyName, interceptSeconds, launchDate);
}

function nextState(
  mission: MissionConfig,
  state: State,
  dt: number,
  elapsedSeconds: number,
  accelerationFn: Parameters<typeof rk4Step>[3]
) {
  switch (mission.integrator) {
    case "Leapfrog":
      return leapfrogStep(state, dt, elapsedSeconds, accelerationFn);
    case "Verlet":
      return verletStep(state, dt, elapsedSeconds, accelerationFn);
    case "RK45":
      return rk45Step(state, dt, elapsedSeconds, accelerationFn);
    case "RK4":
    default:
      return rk4Step(state, dt, elapsedSeconds, accelerationFn);
  }
}
