import { describe, expect, it } from "vitest";
import { paperResultExpectations, reproducePaperResults } from "@/scripts/reproduce-paper-results";

describe("paper Table 2 reproduction", () => {
  it("matches peak speed, final v-infinity, and 90-year distance within 0.5%", () => {
    const results = reproducePaperResults();

    for (const expected of paperResultExpectations) {
      const actual = results.find((row) => row.configuration === expected.name);
      expect(actual, `${expected.name} result`).toBeDefined();
      if (!actual) continue;

      for (const metric of ["peakSpeedKps", "finalVInfinityKps", "distanceAt90YearsAu"] as const) {
        const relativeError = Math.abs(actual[metric] - expected[metric]) / expected[metric];
        expect(relativeError, `${expected.name} ${metric}`).toBeLessThanOrEqual(0.005);
      }
    }
  });
});
