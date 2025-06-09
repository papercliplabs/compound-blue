import { MathLib, RoundingDirection } from "@morpho-org/blue-sdk";

// Allow 0.03% buffer for max transfers on rebasing tokens
// This gives ~1 day grace period for execution if rebasing at 10% APY, which is useful for multisigs (also aligns with bundler permits).
const TOKEN_REBASING_MARGIN = 300000000000000n; // Scaled by WAD

export function computeAmountWithRebasingMargin(amount: bigint) {
  return MathLib.mulDivDown(amount, MathLib.WAD + TOKEN_REBASING_MARGIN, MathLib.WAD);
}

// maxSlippageTolerance is a percentage [0,1]
export function computeAmountWithSlippageSurplus(amount: bigint, maxSlippageTolerance: number) {
  return MathLib.mulDivDown(amount, BigInt(Math.floor((1 + maxSlippageTolerance) * Number(MathLib.WAD))), MathLib.WAD);
}

export function computeScaledAmount(
  amount: bigint,
  scalingFactor: number,
  roundingDirection: RoundingDirection = "Down"
) {
  if (scalingFactor == 1) {
    return amount;
  }
  return MathLib.mulDiv(
    amount,
    BigInt(Math.floor(scalingFactor * Number(MathLib.WAD))),
    MathLib.WAD,
    roundingDirection
  );
}

/**
 * Compute the slippage tolerance per swap given a total slippage and the number of sequential swaps liquidity will pass through
 * @param totalSlippageTolerance The total slippage tolerance for the entire operation - must be positive
 * @param swaps The number of sequential swaps liquidity will pass through - must be a positive integer
 * @returns The slippage tolerance per swap
 * @throws {RangeError} If swaps is not a positive integer
 * @throws {RangeError} If totalSlippageTolerance is not positive
 */
export function computeSlippageTolerancePerSwap(totalSlippageTolerance: number, swaps: number) {
  if (!Number.isInteger(swaps) || swaps <= 0) {
    throw new RangeError("The 'swaps' parameter must be a positive integer.");
  }
  if (totalSlippageTolerance <= 0) {
    throw new RangeError("The 'totalSlippageTolerance' parameter must be positive.");
  }
  return 1 - Math.pow(1 - totalSlippageTolerance, 1 / swaps);
}
