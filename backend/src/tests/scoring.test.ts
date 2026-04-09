import { describe, it, expect } from "vitest";
import { computeAcquisitionScore } from "../services/scoring.js";

describe("computeAcquisitionScore", () => {
  it("returns the exact value for known inputs", () => {
    // raw = 0.2*0.4 + 0.15*0.3 - 0.2*0.3 = 0.08 + 0.045 - 0.06 = 0.065
    const score = computeAcquisitionScore({
      growthRate: 0.2,
      profitMargin: 0.15,
      debtScore: 0.2,
    });
    expect(score).toBe(0.065);
  });

  it("returns a high score for an ideal acquisition target", () => {
    // raw = 0.5*0.4 + 0.4*0.3 - 0.0*0.3 = 0.20 + 0.12 - 0 = 0.32
    const score = computeAcquisitionScore({
      growthRate: 0.5,
      profitMargin: 0.4,
      debtScore: 0.0,
    });
    expect(score).toBe(0.32);
  });

  it("returns a negative score for a distressed, highly-leveraged company", () => {
    // raw = 0.02*0.4 + 0.03*0.3 - 1.0*0.3 = 0.008 + 0.009 - 0.3 = -0.283
    const score = computeAcquisitionScore({
      growthRate: 0.02,
      profitMargin: 0.03,
      debtScore: 1.0,
    });
    expect(score).toBe(-0.283);
  });

  it("applies growth weight of 0.4 correctly", () => {
    const base = computeAcquisitionScore({ growthRate: 0.1, profitMargin: 0.1, debtScore: 0.3 });
    const higher = computeAcquisitionScore({ growthRate: 0.2, profitMargin: 0.1, debtScore: 0.3 });
    // +0.1 growth × 0.4 weight = +0.04
    expect(higher - base).toBeCloseTo(0.04, 5);
  });

  it("applies margin weight of 0.3 correctly", () => {
    const base = computeAcquisitionScore({ growthRate: 0.1, profitMargin: 0.1, debtScore: 0.3 });
    const higher = computeAcquisitionScore({ growthRate: 0.1, profitMargin: 0.2, debtScore: 0.3 });
    // +0.1 margin × 0.3 weight = +0.03
    expect(higher - base).toBeCloseTo(0.03, 5);
  });

  it("applies debt weight of -0.3 correctly — higher debt lowers score", () => {
    const low = computeAcquisitionScore({ growthRate: 0.1, profitMargin: 0.1, debtScore: 0.2 });
    const high = computeAcquisitionScore({ growthRate: 0.1, profitMargin: 0.1, debtScore: 0.8 });
    expect(low).toBeGreaterThan(high);
    // +0.6 debt × 0.3 weight = -0.18 on score
    expect(low - high).toBeCloseTo(0.18, 5);
  });

  it("rounds to at most 3 decimal places", () => {
    const score = computeAcquisitionScore({
      growthRate: 0.333,
      profitMargin: 0.222,
      debtScore: 0.111,
    });
    const decimals = score.toString().split(".")[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(3);
  });

  it("handles zero inputs without throwing", () => {
    const score = computeAcquisitionScore({ growthRate: 0, profitMargin: 0, debtScore: 0 });
    expect(score).toBe(0);
  });
});
