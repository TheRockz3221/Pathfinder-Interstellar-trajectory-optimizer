import { AU_M, DAY_S, G, YEAR_S, celestialBodies } from "@/lib/constants/celestial-bodies";
import { propulsionModels } from "@/lib/constants/propulsion";
import type { CelestialBodyName, GravityAssistEvent, GravityAssistPlan, MissionConfig, SimulationStep, TrajectoryResult, Vector3 } from "@/lib/types";
import { leapfrogStep, rk45Step, rk4Step, type State, verletStep } from "@/lib/physics/integrators";
import {
  add,
  bodyPositionAtTime,
  bodyVelocityAtTime,
  distance,
  estimateMissionScore,
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
const TURN_RESOLUTION = 80;
const EARTH_SPHERE_OF_INFLUENCE_KM = 925_000;
const ASSIST_RESOLUTION_DISTANCE_M = 0.5 * AU_M;

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
  const gravityBodies =
    options.gravityBodies ??
    GRAVITY_BODIES.filter(
      (bodyName) =>
        mission.applyGravityAssists || !mission.gravityAssists.some((assist) => assist.planetName === bodyName)
    );
  const thrustEnabled = options.thrustEnabled ?? true;
  const orderedAssists = [...mission.gravityAssists].sort((a, b) => a.flybyOrder - b.flybyOrder);
  let fuelRemainingKg = mission.fuelMassKg;
  let deltaVMps = 0;
  let traveledM = 0;
  let maxVelocity = mission.initialVelocityMps;
  let elapsedSeconds = 0;
  let timestep = 0;
  const launchBodyPosition = bodyPositionAtTime(mission.launchBody, 0, mission.launchDate);
  const launchVelocity = bodyVelocityAtTime(mission.launchBody, 0, mission.launchDate);
  const initialDestinationDistanceM = distance(
    launchBodyPosition,
    bodyPositionAtTime(mission.destination, 0, mission.launchDate)
  );
  const launchDirection =
    magnitude(launchVelocity) > 0
      ? normalize(launchVelocity)
      : normalize(subtract(guidanceTarget(launchBodyPosition, mission.initialVelocityMps, 0), launchBodyPosition));
  const launchPosition =
    mission.launchBody === "Earth"
      ? add(launchBodyPosition, scale(launchDirection, EARTH_SPHERE_OF_INFLUENCE_KM * 1_000))
      : launchBodyPosition;
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

    recordStep();

    if (distance(state.position, bodyPositionAtTime(mission.destination, elapsedSeconds, mission.launchDate)) < Math.max(destination.radiusKm * 20_000, 0.03 * AU_M)) {
      break;
    }
  }

  const travelTimeYears = steps.at(-1)!.elapsedSeconds / YEAR_S;
  const finalStep = steps.at(-1)!;
  const finalDestinationDistanceM = distance(
    finalStep.position,
    bodyPositionAtTime(mission.destination, finalStep.elapsedSeconds, mission.launchDate)
  );
  const destinationProgress =
    initialDestinationDistanceM > 0
      ? (initialDestinationDistanceM - finalDestinationDistanceM) / initialDestinationDistanceM
      : 0;
  const result: TrajectoryResult = {
    travelTimeYears,
    totalDistanceAu: traveledM / AU_M,
    maxVelocityKps: maxVelocity / 1_000,
    averageVelocityKps: traveledM / Math.max(steps.at(-1)!.elapsedSeconds, 1) / 1_000,
    deltaVKps: deltaVMps / 1_000,
    optimizationScore: estimateMissionScore(mission, fuelRemainingKg, deltaVMps, destinationProgress),
    fuelRemainingKg,
    simulationData: steps,
    gravityAssistEvents: mission.applyGravityAssists
      ? orderedAssists.flatMap((assist) => {
          const event = findGravityAssistEvent(assist, steps, mission.launchDate);
          return event ? [event] : [];
        })
      : []
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
    const assistResolutionStep = orderedAssists.reduce((minimumStep, assist) => {
      const relativePosition = subtract(
        state.position,
        bodyPositionAtTime(assist.planetName, elapsedSeconds, mission.launchDate)
      );
      const separationM = magnitude(relativePosition);
      if (separationM >= ASSIST_RESOLUTION_DISTANCE_M) return minimumStep;
      const relativeSpeedMps = magnitude(
        subtract(state.velocity, bodyVelocityAtTime(assist.planetName, elapsedSeconds, mission.launchDate))
      );
      return Math.min(minimumStep, separationM / Math.max(relativeSpeedMps, 1) / 50);
    }, Number.POSITIVE_INFINITY);
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

    const desiredStep = Math.min(
      outputStepSeconds,
      MAX_INTERNAL_STEP_SECONDS,
      turnLimitedStep,
      assistResolutionStep,
      propulsiveStep,
      fuelLimitedStep,
      remainingSeconds
    );
    return desiredStep;
  }

  function guidanceTarget(position: Vector3, speedMps: number, elapsedSeconds: number) {
    return leadBodyPosition(mission.destination, position, speedMps, elapsedSeconds, mission.launchDate);
  }

}

function findGravityAssistEvent(
  assist: GravityAssistPlan,
  steps: SimulationStep[],
  launchDate: string
): GravityAssistEvent | undefined {
  const body = celestialBodies[assist.planetName];
  const periapsisM = (body.radiusKm + Math.max(assist.closestApproachKm, 100)) * 1_000;
  const targetCorridorM = periapsisM + 3 * body.radiusKm * 1_000;
  const sphereOfInfluenceM =
    body.semiMajorAxisAu * AU_M * Math.pow(body.massKg / celestialBodies.Sun.massKg, 2 / 5);
  const captureRadiusM = Math.max(targetCorridorM, sphereOfInfluenceM);
  let closestDistanceM = Number.POSITIVE_INFINITY;
  let closestElapsedSeconds = 0;
  let closestRelativeVelocityMps = 0;
  let firstCaptureIndex = -1;
  let lastCaptureIndex = -1;

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const bodyPosition = bodyPositionAtTime(assist.planetName, step.elapsedSeconds, launchDate);
    const separationM = distance(step.position, bodyPosition);
    if (separationM <= captureRadiusM) {
      if (firstCaptureIndex < 0) firstCaptureIndex = index;
      lastCaptureIndex = index;
    }
    if (index >= steps.length - 1) continue;

    const next = steps[index + 1];
    const nextBodyPosition = bodyPositionAtTime(assist.planetName, next.elapsedSeconds, launchDate);
    const relativeStart = subtract(step.position, bodyPosition);
    const relativeEnd = subtract(next.position, nextBodyPosition);
    const relativeDelta = subtract(relativeEnd, relativeStart);
    const deltaSquared = relativeDelta.x ** 2 + relativeDelta.y ** 2 + relativeDelta.z ** 2;
    const fraction =
      deltaSquared > 0
        ? Math.min(1, Math.max(0, -dot(relativeStart, relativeDelta) / deltaSquared))
        : 0;
    const closestRelative = add(relativeStart, scale(relativeDelta, fraction));
    const distanceM = magnitude(closestRelative);
    if (distanceM < closestDistanceM) {
      closestDistanceM = distanceM;
      closestElapsedSeconds = step.elapsedSeconds + (next.elapsedSeconds - step.elapsedSeconds) * fraction;
      const probeVelocity = add(step.velocity, scale(subtract(next.velocity, step.velocity), fraction));
      closestRelativeVelocityMps = magnitude(
        subtract(probeVelocity, bodyVelocityAtTime(assist.planetName, closestElapsedSeconds, launchDate))
      );
    }
  }

  if (
    closestDistanceM < body.radiusKm * 1_000 ||
    closestDistanceM > targetCorridorM ||
    firstCaptureIndex < 0 ||
    lastCaptureIndex <= firstCaptureIndex
  ) {
    return undefined;
  }

  const incomingSpeedMps = magnitude(steps[firstCaptureIndex].velocity);
  const outgoingSpeedMps = magnitude(steps[lastCaptureIndex].velocity);
  return {
    planetName: assist.planetName,
    flybyOrder: assist.flybyOrder,
    elapsedSeconds: closestElapsedSeconds,
    closestApproachKm: assist.closestApproachKm,
    detectedDistanceKm: closestDistanceM / 1_000,
    relativeSpeedMps: closestRelativeVelocityMps,
    incomingSpeedMps,
    velocityGainMps: outgoingSpeedMps - incomingSpeedMps,
    outgoingSpeedMps
  };
}

function dot(a: Vector3, b: Vector3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
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
