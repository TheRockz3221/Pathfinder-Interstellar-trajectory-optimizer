import { describe, expect, it } from "vitest";
import { runOptimizationSeeds } from "@/lib/optimization/optimizer";
import { defaultMission } from "@/lib/state/mission-store";

describe("differential evolution", () => {
  it("reports mean and min/max metrics across requested seeds", () => {
    const batch = runOptimizationSeeds(defaultMission, 2);

    expect(batch.seedMetrics).toHaveLength(2);
    expect(batch.summary.count).toBe(2);
    for (const range of [batch.summary.travelTimeYears, batch.summary.deltaVKps, batch.summary.score]) {
      expect(range.min).toBeLessThanOrEqual(range.mean);
      expect(range.mean).toBeLessThanOrEqual(range.max);
    }
  });

  it("rejects an invalid seed count", () => {
    expect(() => runOptimizationSeeds(defaultMission, 0)).toThrow(RangeError);
  });
});
