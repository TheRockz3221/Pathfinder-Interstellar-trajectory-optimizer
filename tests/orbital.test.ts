import { describe, expect, it } from "vitest";
import { escapeVelocity, gravityAssistVelocityGain, rocketEquationDeltaV, solarRadiationPressureAcceleration } from "@/lib/physics/orbital";
import { AU_M } from "@/lib/constants/celestial-bodies";

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

  it("keeps Jupiter's velocity change below 5 km/s at 400 km/s and 62,000 km altitude", () => {
    const assist = gravityAssistVelocityGain("Jupiter", 62_000, 400_000);
    expect(assist.velocityGainMps / 1_000).toBeLessThan(5);
  });
});
