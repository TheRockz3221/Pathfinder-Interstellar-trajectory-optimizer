import { AU_M, YEAR_S, celestialBodies } from "@/lib/constants/celestial-bodies";
import { propulsionModels } from "@/lib/constants/propulsion";
import type { MissionConfig, SimulationStep, TrajectoryResult, Vector3 } from "@/lib/types";
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

export function runTrajectorySimulation(mission: MissionConfig, requestedSteps = 900): TrajectoryResult {
  const origin = celestialBodies[mission.launchBody];
  const destination = celestialBodies[mission.destination];
  const model = propulsionModels[mission.propulsionType];
  const maxSteps = Math.min(Math.max(requestedSteps, 120), 120_000);
  const durationSeconds = mission.maxMissionDurationYears * YEAR_S;
  const dt = durationSeconds / maxSteps;
  const dryMassKg = mission.payloadMassKg;
  const initialDirection = normalize(subtract(destination.positionAtEpoch, origin.positionAtEpoch));
  let fuelRemainingKg = mission.fuelMassKg;
  let deltaVMps = 0;
  let traveledM = 0;
  let maxVelocity = 0;
  let previousPosition = origin.positionAtEpoch;

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
  const thrustDutyCycle = Math.min(1, availableDeltaV / Math.max(thrustLimit * durationSeconds, 1));

  const steps: SimulationStep[] = [];

  const accelerationFn = (position: Vector3, velocity: Vector3, elapsedSeconds: number) => {
    const gravity = nBodyAcceleration(position, [...GRAVITY_BODIES]);
    const targetDirection = normalize(subtract(destination.positionAtEpoch, position));
    const coastBias = Math.max(0.08, 1 - elapsedSeconds / durationSeconds);
    let thrustMagnitude = elapsedSeconds <= durationSeconds * thrustDutyCycle ? thrustLimit * coastBias : 0;

    if (mission.propulsionType === "Solar Sail") {
      const distanceFromSunM = Math.max(distance(position, celestialBodies.Sun.positionAtEpoch), 0.05 * AU_M);
      thrustMagnitude = solarRadiationPressureAcceleration(
        distanceFromSunM,
        mission.propulsionSettings.sailAreaM2 ?? 90_000,
        mission.propulsionSettings.reflectivity ?? 0.88,
        mission.payloadMassKg + mission.fuelMassKg
      );
    }

    const thrust = scale(targetDirection, thrustMagnitude);
    const damping = scale(velocity, -1e-10);
    return add(add(gravity, thrust), damping);
  };

  for (let timestep = 0; timestep <= maxSteps; timestep++) {
    const elapsedSeconds = timestep * dt;
    const acceleration = accelerationFn(state.position, state.velocity, elapsedSeconds);
    const velocityMps = magnitude(state.velocity);
    maxVelocity = Math.max(maxVelocity, velocityMps);
    traveledM += distance(previousPosition, state.position);
    previousPosition = state.position;

    if (mission.propulsionType !== "Solar Sail" && fuelRemainingKg > 0 && elapsedSeconds <= durationSeconds * thrustDutyCycle) {
      const coastBias = Math.max(0.08, 1 - elapsedSeconds / durationSeconds);
      const burnDeltaV = Math.min(thrustLimit * coastBias * dt * model.fuelEfficiency, availableDeltaV - deltaVMps);
      const fuelUsed = mission.fuelMassKg * Math.max(0, burnDeltaV) / Math.max(availableDeltaV, 1);
      fuelRemainingKg = Math.max(0, fuelRemainingKg - fuelUsed);
      deltaVMps += Math.max(0, burnDeltaV);
    }

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

    if (distance(state.position, destination.positionAtEpoch) < Math.max(destination.radiusKm * 20_000, 0.03 * AU_M)) {
      break;
    }

    state = nextState(mission, state, dt, elapsedSeconds, accelerationFn);
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
