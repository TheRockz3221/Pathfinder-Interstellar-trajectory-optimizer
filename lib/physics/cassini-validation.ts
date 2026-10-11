import { G, celestialBodies } from "@/lib/constants/celestial-bodies";
import { gravityAssistVelocityGain, magnitude } from "@/lib/physics/orbital";
import type { Vector3 } from "@/lib/types";

const inboundPositionKm: Vector3 = {
  x: -794_454.9150555449,
  y: 420_987.1591724568,
  z: 33_163.72647737284
};
const inboundVelocityKps: Vector3 = {
  x: 14.08809191567658,
  y: -7.646837927943295,
  z: -0.594155209691944
};
const outboundPositionKm: Vector3 = {
  x: 1_857_657.310340911,
  y: -297_065.0090438061,
  z: -53_808.40306295818
};
const outboundVelocityKps: Vector3 = {
  x: 15.83655121530415,
  y: -2.456908796425961,
  z: -0.4560264742183199
};

function asymptoticSpeedKps(positionKm: Vector3, velocityKps: Vector3) {
  const earthMuKm3S2 = (G * celestialBodies.Earth.massKg) / 1_000_000_000;
  const radiusKm = magnitude(positionKm);
  return Math.sqrt(magnitude(velocityKps) ** 2 - (2 * earthMuKm3S2) / radiusKm);
}

const inboundVInfinityKps = asymptoticSpeedKps(inboundPositionKm, inboundVelocityKps);
const outboundVInfinityKps = asymptoticSpeedKps(outboundPositionKm, outboundVelocityKps);
const approachVInfinityMps = ((inboundVInfinityKps + outboundVInfinityKps) / 2) * 1_000;
const ephemerisDeltaVMps = magnitude({
  x: (outboundVelocityKps.x - inboundVelocityKps.x) * 1_000,
  y: (outboundVelocityKps.y - inboundVelocityKps.y) * 1_000,
  z: (outboundVelocityKps.z - inboundVelocityKps.z) * 1_000
});
const simulatedDeltaVMps = gravityAssistVelocityGain("Earth", 1_186, approachVInfinityMps).velocityGainMps;

export const cassiniEarthFlybyValidation = {
  date: "1999-08-18",
  periapsisAltitudeKm: 1_186,
  approachVInfinityMps,
  inboundVInfinityKps,
  outboundVInfinityKps,
  ephemerisDeltaVMps,
  simulatedDeltaVMps,
  percentDifference: (Math.abs(simulatedDeltaVMps - ephemerisDeltaVMps) / ephemerisDeltaVMps) * 100,
  sourceLinks: {
    altitude: "https://ntrs.nasa.gov/citations/20020043280",
    ephemeris: "https://ssd.jpl.nasa.gov/horizons/"
  }
};
