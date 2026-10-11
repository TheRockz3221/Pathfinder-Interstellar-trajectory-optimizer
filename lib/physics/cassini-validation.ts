import { gravityAssistVelocityGain } from "@/lib/physics/orbital";

const approachVInfinityMps = 16.016 * 1_000;
const documentedDeltaVMps = 5_500;
const simulatedDeltaVMps = gravityAssistVelocityGain("Earth", 1_171, approachVInfinityMps).velocityGainMps;

export const cassiniEarthFlybyValidation = {
  date: "1999-08-18",
  periapsisAltitudeKm: 1_171,
  approachVInfinityMps,
  documentedDeltaVMps,
  simulatedDeltaVMps,
  percentDifference: (Math.abs(simulatedDeltaVMps - documentedDeltaVMps) / documentedDeltaVMps) * 100,
  sourceLinks: {
    altitude: "https://www.jpl.nasa.gov/news/cassini-successfully-completes-flyby-of-earth/",
    ephemeris: "https://ssd.jpl.nasa.gov/horizons/"
  }
};
