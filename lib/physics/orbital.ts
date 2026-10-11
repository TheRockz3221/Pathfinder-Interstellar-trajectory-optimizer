import {
  DAY_S,
  AU_M,
  G,
  SOLAR_LUMINOSITY_W,
  SPEED_OF_LIGHT_MPS,
  celestialBodies
} from "@/lib/constants/celestial-bodies";
import { propulsionModels } from "@/lib/constants/propulsion";
import type { CelestialBodyName, MissionConfig, PropulsionType, Vector3 } from "@/lib/types";

export const zeroVector: Vector3 = { x: 0, y: 0, z: 0 };

export function add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vector3, scalar: number): Vector3 {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

export function magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v: Vector3): Vector3 {
  const length = magnitude(v);
  return length === 0 ? zeroVector : scale(v, 1 / length);
}

export function distance(a: Vector3, b: Vector3): number {
  return magnitude(subtract(a, b));
}

export function bodyPositionAtTime(bodyName: CelestialBodyName, elapsedSeconds = 0, launchDate?: string): Vector3 {
  const body = celestialBodies[bodyName];
  if (body.orbitalPeriodDays <= 0) {
    return body.positionAtEpoch;
  }

  const launchOffsetDays = launchDate ? daysSinceReferenceEpoch(launchDate) : 0;
  const elapsedDays = elapsedSeconds / DAY_S;
  const phase = body.initialPhaseRad + ((launchOffsetDays + elapsedDays) / body.orbitalPeriodDays) * Math.PI * 2;
  const radiusM = body.semiMajorAxisAu * AU_M;
  return {
    x: Math.cos(phase) * radiusM,
    y: Math.sin(phase) * radiusM,
    z: 0
  };
}

export function bodyVelocityAtTime(bodyName: CelestialBodyName, elapsedSeconds = 0, launchDate?: string): Vector3 {
  const body = celestialBodies[bodyName];
  if (body.orbitalPeriodDays <= 0) {
    return zeroVector;
  }

  const launchOffsetDays = launchDate ? daysSinceReferenceEpoch(launchDate) : 0;
  const elapsedDays = elapsedSeconds / DAY_S;
  const phase = body.initialPhaseRad + ((launchOffsetDays + elapsedDays) / body.orbitalPeriodDays) * Math.PI * 2;
  const radiusM = body.semiMajorAxisAu * AU_M;
  const angularRateRadS = (Math.PI * 2) / (body.orbitalPeriodDays * DAY_S);
  return {
    x: -Math.sin(phase) * radiusM * angularRateRadS,
    y: Math.cos(phase) * radiusM * angularRateRadS,
    z: 0
  };
}

export function gravitationalAcceleration(
  position: Vector3,
  bodyName: CelestialBodyName,
  elapsedSeconds = 0,
  launchDate?: string
): Vector3 {
  const body = celestialBodies[bodyName];
  const bodyPosition = bodyPositionAtTime(bodyName, elapsedSeconds, launchDate);
  const r = subtract(bodyPosition, position);
  const rMag = Math.max(magnitude(r), body.radiusKm * 1_000);
  return scale(normalize(r), (G * body.massKg) / (rMag * rMag));
}

export function nBodyAcceleration(
  position: Vector3,
  bodies: CelestialBodyName[],
  elapsedSeconds = 0,
  launchDate?: string
): Vector3 {
  return bodies.reduce((acc, body) => add(acc, gravitationalAcceleration(position, body, elapsedSeconds, launchDate)), zeroVector);
}

export function escapeVelocity(bodyName: CelestialBodyName, altitudeKm = 0): number {
  const body = celestialBodies[bodyName];
  return Math.sqrt((2 * G * body.massKg) / ((body.radiusKm + altitudeKm) * 1_000));
}

export function hohmannTransferDeltaV(origin: CelestialBodyName, target: CelestialBodyName): number {
  const sunMass = celestialBodies.Sun.massKg;
  const r1 = Math.max(celestialBodies[origin].semiMajorAxisAu, 0.1) * AU_M;
  const r2 = Math.max(celestialBodies[target].semiMajorAxisAu, 0.1) * AU_M;
  const mu = G * sunMass;
  const dv1 = Math.sqrt(mu / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
  const dv2 = Math.sqrt(mu / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)));
  return Math.abs(dv1) + Math.abs(dv2);
}

export function rocketEquationDeltaV(
  propulsionType: PropulsionType,
  dryMassKg: number,
  fuelMassKg: number,
  specificImpulseOverrideS?: number
): number {
  const model = propulsionModels[propulsionType];
  if (propulsionType === "Solar Sail") {
    return 0;
  }
  const isp = specificImpulseOverrideS ?? model.specificImpulseS;
  const wetMass = dryMassKg + fuelMassKg;
  return 9.80665 * isp * Math.log(wetMass / Math.max(dryMassKg, 1));
}

export function solarRadiationPressureAcceleration(
  distanceFromSunM: number,
  sailAreaM2: number,
  reflectivity: number,
  spacecraftMassKg: number
): number {
  const pressure = SOLAR_LUMINOSITY_W / (4 * Math.PI * distanceFromSunM ** 2 * SPEED_OF_LIGHT_MPS);
  return (pressure * sailAreaM2 * (1 + reflectivity)) / spacecraftMassKg;
}

export function gravityAssistVelocityGain(
  planetName: CelestialBodyName,
  closestApproachKm: number,
  incomingVelocityMps: number
) {
  const planet = celestialBodies[planetName];
  const periapsisM = (planet.radiusKm + Math.max(closestApproachKm, 100)) * 1_000;
  const mu = G * planet.massKg;
  const turningAngleRad = 2 * Math.asin(1 / (1 + (periapsisM * incomingVelocityMps ** 2) / mu));
  const velocityGainMps = 2 * incomingVelocityMps * Math.sin(turningAngleRad / 2);
  const energyIncreaseJkg = 0.5 * velocityGainMps ** 2;
  return {
    velocityGainMps,
    turningAngleDeg: (turningAngleRad * 180) / Math.PI,
    energyIncreaseJkg
  };
}

export function orbitalEnergy(position: Vector3, velocity: Vector3, centralBody: CelestialBodyName = "Sun") {
  const mu = G * celestialBodies[centralBody].massKg;
  const r = Math.max(distance(position, celestialBodies[centralBody].positionAtEpoch), 1);
  return 0.5 * magnitude(velocity) ** 2 - mu / r;
}

function daysSinceReferenceEpoch(launchDate: string) {
  const parsed = Date.parse(`${launchDate}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  const referenceEpoch = Date.UTC(2000, 0, 1);
  return (parsed - referenceEpoch) / (DAY_S * 1_000);
}

export function estimateMissionScore(
  mission: MissionConfig,
  fuelRemainingKg: number,
  deltaVMps: number,
  destinationProgress: number
) {
  const weights = mission.objectiveWeights;
  const normalizedProgress = clamp(destinationProgress, 0, 1);
  const normalizedFuel = mission.fuelMassKg > 0 ? clamp(fuelRemainingKg / mission.fuelMassKg, 0, 1) : 1;
  const normalizedSafety = clamp(1 - mission.gravityAssists.length * 0.035, 0, 1);
  const deltaVBudget = rocketEquationDeltaV(
    mission.propulsionType,
    mission.payloadMassKg,
    mission.fuelMassKg,
    mission.propulsionSettings.specificImpulseS
  );
  const normalizedDeltaV = clamp(1 - deltaVMps / Math.max(deltaVBudget, 1), 0, 1);
  const totalWeight = weights.travelTime + weights.fuel + weights.safety + weights.deltaV;
  return (
    (weights.travelTime * normalizedProgress +
      weights.fuel * normalizedFuel +
      weights.safety * normalizedSafety +
      weights.deltaV * normalizedDeltaV) /
    totalWeight
  ) * 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
