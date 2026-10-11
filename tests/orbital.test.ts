import { describe, expect, it } from "vitest";
import {
  escapeVelocity,
  gravityAssistVelocityGain,
  estimateMissionScore,
  orbitalEnergy,
  rocketEquationDeltaV,
  solarRadiationPressureAcceleration
} from "@/lib/physics/orbital";
import { AU_M } from "@/lib/constants/celestial-bodies";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import { defaultMission } from "@/lib/state/mission-store";
import { magnitude } from "@/lib/physics/orbital";
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

  it("reproduces Cassini's documented Earth flyby vector delta-v within one percent", () => {
    expect(cassiniEarthFlybyValidation.approachVInfinityMps / 1_000).toBeCloseTo(16.016, 2);
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

  it("keeps the exact trajectory when configured assists are disabled", () => {
    const mission = {
      ...defaultMission,
      gravityAssists: [{ planetName: "Jupiter" as const, flybyOrder: 1, closestApproachKm: 540_000 }]
    };
    const disabled = runTrajectorySimulation({ ...mission, applyGravityAssists: false }, 120);
    const enabled = runTrajectorySimulation({ ...mission, applyGravityAssists: true }, 120);

    expect(disabled.simulationData[0].velocity).toEqual(enabled.simulationData[0].velocity);
    expect(disabled.simulationData[0].position).toEqual(enabled.simulationData[0].position);
    expect(disabled.gravityAssistEvents).toEqual([]);
    expect(enabled.gravityAssistEvents).toEqual([]);
    expect(disabled.simulationData).toEqual(enabled.simulationData);
  });

});
