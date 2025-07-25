import { Market, MathLib } from "@morpho-org/blue-sdk";

import { computeAmountWithSlippageSurplus } from "@/actions/utils/math";
import { MAX_BORROW_LTV_MARGIN, MAX_SLIPPAGE_TOLERANCE_LIMIT } from "@/config";
import { descaleBigIntToNumber } from "@/utils/format";

const LEVERAGE_FACTOR_CEILING = 100; // Only clamps if lltv * (1 - S) > 99%

// Inputs:
//  M: margin / initial collateral amount (M > 0)
//  L: leverage factor (1 < L <= L_MAX)
//  S: slippage tolerance (based on P_market) (0 < S < 1)

// Market state:
//  LLTV: market liquidation loan-to-value ratio
//  P_market: price of 1 asset of collateral token quoted in 1 asset of loan token from the markets oracle. I.e P_market has units: [loan asset] / [collateral asset]

// Derived variables:
//  L_MAX: max leverage factor
//  C: final position collateral amount
//  B: final position borrow amount

// Derivations:
//  C = M * L
//  B_QUOTE = (C - M) * P_market -> Quote at the market **oracle price** to swap to the reamining required collateral amount (C - M)
//  B = B_QUOTE * (1 + S) -> Max amount needed account for slippage of exact output swap to the required collateral
//    = (C - M) * P_market * (1 + S)
//    = M * (L - 1) * P_market * (1 + S) -> Note that Y = (L - 1) * (1 + S) is the yield multiplier

// LTV_MAX = B / (C * P_market) -> With worst case slippage
//         = M * (L - 1) * P_market * (1 + S) / (M * L * P_market)
//         = (L - 1) * (1 + S) / L

// We must have LTV_MAX < LLTV
//  =>  (L - 1) * (1 + S) / L < LLTV
//  =>  L * (1 + S) - (1 + S) < LLTV * L  // Note L > 0
//  =>  L * (1 + S - LLTV) < (1 + S)
//  =>  L < (1 + S) / (1 + S - LLTV)      // Note 1 + S - LLTV > 0, since S > 0 and LLTV <= 1
//  =>  L_MAX = (1 + S) / (1 + S - LLTV) -> Should also subtract MAX_BORROW_LTV_MARGIN from LLTV to prevent creating loans at the liq threshold (like we do in rest of app)

// Then the max yield multiplier is (if this is preferred over considering leverage):
//   Y_MAX = (L_MAX - 1) * (1 + S)

// Note: The slippage tolerance S is enforced against P_market (not P_dex).
// This means that if P_dex < P_market, the dex swap will have less slippage tolerance to work with.
// Any excess loan not needed to repay the collateral (i.e didn't consume full slippage, or positive slippage) will be repaid to reduce the loan amount (and thus LTV).
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
  if (maxSlippageTolerance <= 0 || maxSlippageTolerance >= MAX_SLIPPAGE_TOLERANCE_LIMIT) {
    throw new Error(`Max slippage tolerance must be between 0 and ${MAX_SLIPPAGE_TOLERANCE_LIMIT}.`);
  }

  const lltv = descaleBigIntToNumber(market.params.lltv, 18);
  const maxLeverageFactor = computeMaxLeverageFactor(lltv, maxSlippageTolerance);

  if (leverageFactor <= 1 || leverageFactor > maxLeverageFactor) {
    throw new Error(`Leverage factor must be between 1 and ${maxLeverageFactor}.`);
  }
  if (lltv < MAX_BORROW_LTV_MARGIN) {
    throw new Error(`LLTV must be at least ${MAX_BORROW_LTV_MARGIN}.`);
  }

  const collateralAmount = MathLib.mulDivDown(margin, BigInt(leverageFactor * Number(MathLib.WAD)), MathLib.WAD);
  const additionalCollateralNeeded = collateralAmount - margin;

  const quoteLoanAmount = market.getCollateralValue(additionalCollateralNeeded);
  if (quoteLoanAmount == undefined) {
    throw new Error("Oracle issue: unable to price collateral in the loan asset.");
  }

  const loanAmountWithSlippage = computeAmountWithSlippageSurplus(quoteLoanAmount, maxSlippageTolerance);

  const ltv = Number(loanAmountWithSlippage) / Number(market.getCollateralValue(collateralAmount));

  return {
    collateralAmount,
    loanAmount: loanAmountWithSlippage,
    ltv,
  };
}

// Assume maxSlippageTolerance is between 0 and 1 exclusive (already checked)
export function computeMaxLeverageFactor(lltv: number, maxSlippageTolerance: number) {
  const maxLeverageFactor = Math.min(
    (1 + maxSlippageTolerance) / (1 + maxSlippageTolerance - (lltv - MAX_BORROW_LTV_MARGIN)),
    LEVERAGE_FACTOR_CEILING
  );
  return maxLeverageFactor;
}
