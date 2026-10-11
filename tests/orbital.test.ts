import { describe, expect, it } from "vitest";
import {
  escapeVelocity,
  gravityAssistVelocityGain,
  estimateMissionScore,
  orbitalEnergy,
  rocketEquationDeltaV,
  solarRadiationPressureAcceleration
} from "@/lib/physics/orbital";
import { AU_M, G, YEAR_S, celestialBodies } from "@/lib/constants/celestial-bodies";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import { defaultMission } from "@/lib/state/mission-store";
import { bodyPositionAtTime, distance, magnitude } from "@/lib/physics/orbital";
import { cassiniEarthFlybyValidation } from "@/lib/physics/cassini-validation";
import { propulsionModels } from "@/lib/constants/propulsion";

describe("orbital mechanics helpers", () => {
  it("computes Earth escape velocity near the known surface value", () => {
    expect(escapeVelocity("Earth") / 1_000).toBeGreaterThan(11.1);
    expect(escapeVelocity("Earth") / 1_000).toBeLessThan(11.3);
  });

  it("applies the rocket equation for chemical propulsion", () => {
    const deltaV = rocketEquationDeltaV("Chemical Rocket", 10_000, 30_000);
    expect(deltaV / 1_000).toBeGreaterThan(5.9);
    expect(deltaV / 1_000).toBeLessThan(6.2);
  });

  it("reduces solar sail acceleration with distance from the Sun", () => {
    const atOneAu = solarRadiationPressureAcceleration(AU_M, 10_000, 0.9, 500);
    const atTwoAu = solarRadiationPressureAcceleration(2 * AU_M, 10_000, 0.9, 500);
    expect(atOneAu / atTwoAu).toBeCloseTo(4, 1);
  });

  it("returns a positive patched-conics gravity assist estimate", () => {
    const assist = gravityAssistVelocityGain("Jupiter", 540_000, 12_000);
    expect(assist.velocityGainMps).toBeGreaterThan(0);
    expect(assist.turningAngleDeg).toBeGreaterThan(0);
  });

  it("keeps Jupiter's vector change under 5 km/s at 400 km/s and 62,000 km altitude", () => {
    const assist = gravityAssistVelocityGain("Jupiter", 62_000, 400_000);
    expect(assist.velocityGainMps / 1_000).toBeLessThan(5);
  });

  it("compares the Cassini Earth flyby estimate with the documented 5.5 km/s boost", () => {
    expect(cassiniEarthFlybyValidation.periapsisAltitudeKm).toBe(1_171);
    expect(cassiniEarthFlybyValidation.approachVInfinityMps).toBeCloseTo(16_016, 8);
    expect(cassiniEarthFlybyValidation.documentedDeltaVMps).toBe(5_500);
    expect(cassiniEarthFlybyValidation.percentDifference).toBeLessThan(1);
  });

  it("conserves two-body coast energy over a long Sun-only no-thrust run", () => {
    const mission = {
      ...defaultMission,
      destination: "Alpha Centauri" as const,
      gravityAssists: [],
      maxMissionDurationYears: 25,
      initialVelocityMps: 42_000,
      integrator: "RK4" as const
    };
    const result = runTrajectorySimulation(mission, 240, { gravityBodies: ["Sun"], thrustEnabled: false });
    const initialEnergy = orbitalEnergy(result.simulationData[0].position, result.simulationData[0].velocity, "Sun");
    const finalStep = result.simulationData.at(-1)!;
    const finalEnergy = orbitalEnergy(finalStep.position, finalStep.velocity, "Sun");

    expect(Math.abs((finalEnergy - initialEnergy) / initialEnergy)).toBeLessThan(0.0001);
  });

  it("sets launch heliocentric speed to the configured initial velocity", () => {
    const mission = { ...defaultMission, gravityAssists: [], initialVelocityMps: 42_000 };
    const result = runTrajectorySimulation(mission, 120);
    expect(magnitude(result.simulationData[0].velocity)).toBeCloseTo(mission.initialVelocityMps, 8);
  });

  it("starts at Earth's sphere-of-influence boundary without changing total heliocentric launch speed", () => {
    const mission = { ...defaultMission, gravityAssists: [], initialVelocityMps: 42_000 };
    const result = runTrajectorySimulation(mission, 120, { thrustEnabled: false });
    const earthPosition = bodyPositionAtTime(mission.launchBody, 0, mission.launchDate);

    expect(distance(result.simulationData[0].position, earthPosition) / 1_000).toBeCloseTo(925_000, 0);
    expect(magnitude(result.simulationData[0].velocity)).toBeCloseTo(mission.initialVelocityMps, 8);
  });

  it("conserves Sun-specific energy within 0.1% for a two-year no-thrust no-assist coast", () => {
    const mission = {
      ...defaultMission,
      gravityAssists: [],
      maxMissionDurationYears: 2,
      initialVelocityMps: 42_000
    };
    const result = runTrajectorySimulation(mission, 240, { gravityBodies: ["Sun"], thrustEnabled: false });
    const initialEnergy = orbitalEnergy(result.simulationData[0].position, result.simulationData[0].velocity);
    const finalStep = result.simulationData.at(-1)!;
    const finalEnergy = orbitalEnergy(finalStep.position, finalStep.velocity);

    expect(Math.abs((finalEnergy - initialEnergy) / initialEnergy)).toBeLessThan(0.001);
  });

  it("keeps the Sun-only fusion peak within 1% of initial speed plus ideal delta-v", () => {
    const mission = {
      ...defaultMission,
      gravityAssists: [],
      maxMissionDurationYears: 2,
      initialVelocityMps: 42_000,
      propulsionType: "Fusion Rocket" as const,
      maxAccelerationMps2: 0.18
    };
    const idealDeltaVMps = rocketEquationDeltaV(
      mission.propulsionType,
      mission.payloadMassKg,
      mission.fuelMassKg,
      mission.propulsionSettings.specificImpulseS
    );
    const result = runTrajectorySimulation(mission, 240, { gravityBodies: ["Sun"] });

    expect(result.maxVelocityKps * 1_000).toBeLessThanOrEqual(
      (mission.initialVelocityMps + idealDeltaVMps) * 1.01
    );
  });

  it("keeps prograde Fusion peak speed and final v-infinity within 2% of the ideal", () => {
    const mission = {
      ...defaultMission,
      launchDate: "2048-07-16",
      gravityAssists: [{ planetName: "Jupiter" as const, flybyOrder: 1, closestApproachKm: 540_000 }],
      applyGravityAssists: false,
      maxMissionDurationYears: 90,
      initialVelocityMps: 42_000,
      propulsionType: "Fusion Rocket" as const,
      maxAccelerationMps2: 0.18
    };
    const deltaVMps = rocketEquationDeltaV(
      mission.propulsionType,
      mission.payloadMassKg,
      mission.fuelMassKg,
      mission.propulsionSettings.specificImpulseS
    );
    const result = runTrajectorySimulation(mission, 950);
    const finalStep = result.simulationData.at(-1)!;
    const finalEnergy = orbitalEnergy(finalStep.position, finalStep.velocity);
    const finalVInfinityKps = Math.sqrt(2 * finalEnergy) / 1_000;
    const expectedVInfinityKps =
      Math.sqrt((mission.initialVelocityMps / 1_000 + deltaVMps / 1_000) ** 2 - 42.1 ** 2);

    expect(result.maxVelocityKps * 1_000).toBeLessThanOrEqual(
      (mission.initialVelocityMps + deltaVMps) * 1.01
    );
    expect(Math.abs(finalVInfinityKps / expectedVInfinityKps - 1)).toBeLessThan(0.02);
  });

  it("keeps Chemical final v-infinity within 2% of the ideal prograde result", () => {
    const mission = {
      ...defaultMission,
      launchDate: "2048-07-16",
      gravityAssists: [{ planetName: "Jupiter" as const, flybyOrder: 1, closestApproachKm: 540_000 }],
      applyGravityAssists: false,
      maxMissionDurationYears: 90,
      initialVelocityMps: 42_000,
      propulsionType: "Chemical Rocket" as const,
      maxAccelerationMps2: 0.18
    };
    const deltaVMps = rocketEquationDeltaV(
      mission.propulsionType,
      mission.payloadMassKg,
      mission.fuelMassKg,
      mission.propulsionSettings.specificImpulseS
    );
    const result = runTrajectorySimulation(mission, 950);
    const finalStep = result.simulationData.at(-1)!;
    const finalEnergy = orbitalEnergy(finalStep.position, finalStep.velocity);
    const finalVInfinityKps = Math.sqrt(2 * finalEnergy) / 1_000;
    const expectedVInfinityKps =
      Math.sqrt((mission.initialVelocityMps / 1_000 + deltaVMps / 1_000) ** 2 - 42.1 ** 2);

    expect(Math.abs(finalVInfinityKps / expectedVInfinityKps - 1)).toBeLessThan(0.02);
  });

  it("conserves prograde Fusion Sun-specific energy to 0.1% from burn end through year 90", () => {
    const mission = {
      ...defaultMission,
      launchDate: "2048-07-16",
      gravityAssists: [{ planetName: "Jupiter" as const, flybyOrder: 1, closestApproachKm: 540_000 }],
      applyGravityAssists: false,
      maxMissionDurationYears: 90,
      initialVelocityMps: 42_000,
      propulsionType: "Fusion Rocket" as const,
      maxAccelerationMps2: 0.18
    };
    const deltaVMps = rocketEquationDeltaV(
      mission.propulsionType,
      mission.payloadMassKg,
      mission.fuelMassKg,
      mission.propulsionSettings.specificImpulseS
    );
    const result = runTrajectorySimulation(mission, 950);
    const burnEnd = result.simulationData.find(
      (step) => step.deltaVMps >= deltaVMps * (1 - 1e-9)
    )!;
    const energyAt = (step: (typeof result.simulationData)[number]) =>
      orbitalEnergy(step.position, step.velocity);
    const interpolateAtYear = (year: number) => {
      const elapsedSeconds = year * YEAR_S;
      const upperIndex = result.simulationData.findIndex((step) => step.elapsedSeconds >= elapsedSeconds);
      const start = result.simulationData[upperIndex - 1];
      const end = result.simulationData[upperIndex];
      const fraction = (elapsedSeconds - start.elapsedSeconds) / (end.elapsedSeconds - start.elapsedSeconds);
      const position = {
        x: start.position.x + (end.position.x - start.position.x) * fraction,
        y: start.position.y + (end.position.y - start.position.y) * fraction,
        z: start.position.z + (end.position.z - start.position.z) * fraction
      };
      const velocity = {
        x: start.velocity.x + (end.velocity.x - start.velocity.x) * fraction,
        y: start.velocity.y + (end.velocity.y - start.velocity.y) * fraction,
        z: start.velocity.z + (end.velocity.z - start.velocity.z) * fraction
      };
      return orbitalEnergy(position, velocity);
    };
    const energies = [
      { label: "burn end", energyJkg: energyAt(burnEnd) },
      { label: "year 1", energyJkg: interpolateAtYear(1) },
      { label: "year 10", energyJkg: interpolateAtYear(10) },
      { label: "year 90", energyJkg: interpolateAtYear(90) }
    ];

    console.log("Prograde Fusion Sun-specific energy", energies);
    expect(burnEnd).toBeDefined();
    for (const { energyJkg } of energies.slice(1)) {
      expect(Math.abs((energyJkg - energies[0].energyJkg) / energies[0].energyJkg)).toBeLessThan(0.001);
    }
  });

  it("keeps post-burn Sun-specific energy within 5% of the ideal post-burn energy", () => {
    const mission = {
      ...defaultMission,
      launchDate: "2049-06-13",
      gravityAssists: [],
      maxMissionDurationYears: 2,
      initialVelocityMps: 42_000,
      propulsionType: "Fusion Rocket" as const,
      maxAccelerationMps2: 0.18
    };
    const idealDeltaVMps = rocketEquationDeltaV(
      mission.propulsionType,
      mission.payloadMassKg,
      mission.fuelMassKg,
      mission.propulsionSettings.specificImpulseS
    );
    const result = runTrajectorySimulation(mission, 240, { gravityBodies: ["Sun"] });
    const postBurn = result.simulationData.find((step) => step.deltaVMps >= idealDeltaVMps * (1 - 1e-9))!;
    const actualEnergy = orbitalEnergy(postBurn.position, postBurn.velocity);
    const expectedEnergy =
      (mission.initialVelocityMps + idealDeltaVMps) ** 2 / 2 -
      (G * celestialBodies.Sun.massKg) / magnitude(postBurn.position);

    expect(postBurn).toBeDefined();
    expect(Math.abs((actualEnergy - expectedEnergy) / expectedEnergy)).toBeLessThan(0.05);
  });

  it("scores destination progress so propulsion variants do not plateau at the safety term", () => {
    const mission = {
      ...defaultMission,
      objectiveWeights: { travelTime: 70, fuel: 15, safety: 10, deltaV: 5 }
    };
    const slowProgressScore = estimateMissionScore(mission, 0, 0, 466 / 276_000);
    const fastProgressScore = estimateMissionScore(mission, 0, 0, 7_532 / 276_000);

    expect(fastProgressScore).toBeGreaterThan(slowProgressScore);
    expect(slowProgressScore).not.toBeCloseTo(9.65, 2);
  });

  it("uses the fusion model's Isp-consistent effective exhaust velocity", () => {
    const fusion = propulsionModels["Fusion Rocket"];
    expect(fusion.specificImpulseS).toBe(18_000);
    expect(fusion.exhaustVelocityMps).toBeCloseTo(fusion.specificImpulseS * 9.80665, 6);
  });

  it("toggles Jupiter's continuous N-body gravity without changing launch state", () => {
    const mission = {
      ...defaultMission,
      gravityAssists: [{ planetName: "Jupiter" as const, flybyOrder: 1, closestApproachKm: 540_000 }]
    };
    const disabled = runTrajectorySimulation({ ...mission, applyGravityAssists: false }, 120);
    const enabled = runTrajectorySimulation({ ...mission, applyGravityAssists: true }, 120);

    expect(disabled.simulationData[0].velocity).toEqual(enabled.simulationData[0].velocity);
    expect(disabled.simulationData[0].position).toEqual(enabled.simulationData[0].position);
    expect(disabled.gravityAssistEvents).toEqual([]);
    expect(enabled.simulationData).not.toEqual(disabled.simulationData);
  });

});
