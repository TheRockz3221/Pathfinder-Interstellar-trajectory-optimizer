import { AU_M, DAY_S, YEAR_S, celestialBodies } from "@/lib/constants/celestial-bodies";
import { propulsionModels } from "@/lib/constants/propulsion";
import type { CelestialBodyName, MissionConfig, SimulationStep, TrajectoryResult, Vector3 } from "@/lib/types";
import { leapfrogStep, rk45Step, rk4Step, type State, verletStep } from "@/lib/physics/integrators";
import {
  add,
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
const MIN_INTERNAL_STEP_SECONDS = 60;
const TURN_RESOLUTION = 80;

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
  const initialDirection = normalize(subtract(destination.positionAtEpoch, origin.positionAtEpoch));
  const gravityBodies = options.gravityBodies ?? GRAVITY_BODIES;
  const thrustEnabled = options.thrustEnabled ?? true;
  let fuelRemainingKg = mission.fuelMassKg;
  let deltaVMps = 0;
  let traveledM = 0;
  let maxVelocity = mission.initialVelocityMps;
  let elapsedSeconds = 0;
  let timestep = 0;

  let state: State = {
    position: origin.positionAtEpoch,
    velocity: scale(initialDirection, mission.initialVelocityMps)
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
    const gravity = nBodyAcceleration(position, [...gravityBodies]);
    const targetDirection = normalize(subtract(destination.positionAtEpoch, position));
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
      distanceFromSunM: distance(state.position, celestialBodies.Sun.positionAtEpoch),
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

    if (distance(state.position, destination.positionAtEpoch) < Math.max(destination.radiusKm * 20_000, 0.03 * AU_M)) {
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
    simulationData: steps
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
