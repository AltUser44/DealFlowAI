/**
 * Core M&A heuristic (user-specified weights).
 * Inputs are decimals in comparable ranges: growth & margin ~0–0.5 typical;
 * debtScore is 0–1 (higher = more debt burden).
 */
export function computeAcquisitionScore(input: {
  growthRate: number;
  profitMargin: number;
  debtScore: number;
}): number {
  const { growthRate, profitMargin, debtScore } = input;
  const raw =
    growthRate * 0.4 + profitMargin * 0.3 - debtScore * 0.3;
  return Math.round(raw * 1000) / 1000;
}
