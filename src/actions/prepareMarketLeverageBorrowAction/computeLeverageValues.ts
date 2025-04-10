import { MAX_BORROW_LTV_MARGIN } from "@/config";
import { descaleBigIntToNumber } from "@/utils/format";
import { Market } from "@morpho-org/blue-sdk";

const LEVERAGE_FACTOR_CEILING = 100; // Only clamps if lltv * (1 - S) > 99%
const FACTOR_SCALE = 10000;

// Inputs:
//  M: margin / initial collateral amount (M > 0)
//  L: leverage factor (1 < L <= L_MAX)
//  S: slippage tolerance (based on P_market) (0 < S < 1)

// Market state:
//  LLTV: market loan-to-value ratio
//  P_market: price of the collateral in loan asset from market oracle

// Derived variables:
//  L_MAX: max leverage factor
//  C: final position collateral amount
//  B: final position borrow amount
// Derivations:
//  L_MAX = 1 / (1 - LLTV * (1 - S))
//  C = M * L
//  B = (C - M) * P_market / (1 - S)
//    = M * (L - 1) * P_market / (1 - S) -> Note (L - 1) / (1 - S) is the the yield multiplier

// Note: The slippage tolerance S is enforced against P_market (not P_dex).
// This means that if P_dex < P_market, the dex swap will have less slippage tolerance to work with.
// Any excess loan not needed to repay the collateral (i.e didn't consume full slippage) will be repaid to reduce the loan amount (and thus LTV).
// Note: If L = L_MAX, this guarentees LTV < (LLTV - LLTV_MARGIN) for all slippage, and is conservative for larger slippage.

interface ComputeLeverageValuesReturnType {
  collateralAmount: bigint;
  loanAmount: bigint;
  ltv: number;
}

export function computeLeverageValues(
  margin: bigint,
  leverageFactor: number,
  maxSlippageTolerance: number,
  market: Market
): ComputeLeverageValuesReturnType {
  if (margin < 1) {
    throw new Error("Margin cannot be less than 1.");
  }
  if (maxSlippageTolerance <= 0 || maxSlippageTolerance >= 1) {
    throw new Error("Max slippage tolerance must be between 0 and 1.");
  }

  const lltv = descaleBigIntToNumber(market.params.lltv, 18);
  const maxLeverageFactor = computeMaxLeverageFactor(lltv, maxSlippageTolerance);

  if (leverageFactor <= 1 || leverageFactor > maxLeverageFactor) {
    throw new Error(`Leverage factor must be between 1 and ${maxLeverageFactor}.`);
  }
  if (lltv < MAX_BORROW_LTV_MARGIN) {
    throw new Error(`LLTV must be at least ${MAX_BORROW_LTV_MARGIN}.`);
  }

  const collateralAmount = (margin * BigInt(Math.floor(leverageFactor * FACTOR_SCALE))) / BigInt(FACTOR_SCALE);
  const additionalCollateralNeeded = collateralAmount - margin;

  const slippageMultiplier = 1 / (1 - maxSlippageTolerance); // This is guarentted to be >1
  const loanAmountInCollateral =
    (additionalCollateralNeeded * BigInt(Math.ceil(slippageMultiplier * FACTOR_SCALE))) / BigInt(FACTOR_SCALE);

  const loanAmount = market.getCollateralValue(loanAmountInCollateral);
  if (loanAmount == undefined) {
    throw new Error("Oracle issue: unable to price collateral in the loan asset.");
  }

  const ltv = Number(loanAmount) / Number(market.getCollateralValue(collateralAmount));

  return {
    collateralAmount,
    loanAmount,
    ltv,
  };
}

// Assume maxSlippageTolerance is between 0 and 1 exclusive (should check outside)
export function computeMaxLeverageFactor(lltv: number, maxSlippageTolerance: number) {
  const lltvEffective = lltv - MAX_BORROW_LTV_MARGIN; // Only allow borrowing up to margin below LLTV
  const maxLeverageFactor = Math.min(1 / (1 - lltvEffective * (1 - maxSlippageTolerance)), LEVERAGE_FACTOR_CEILING);
  return maxLeverageFactor;
}
