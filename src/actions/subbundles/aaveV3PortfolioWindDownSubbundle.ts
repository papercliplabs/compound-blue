import { BundlerAction, BundlerCall } from "@morpho-org/bundler-sdk-viem";
import Decimal from "decimal.js";
import { Address, Client, erc20Abi, getAddress, isAddressEqual, maxUint256 } from "viem";
import { readContract } from "viem/actions";

import { CHAIN_ID, MAX_SLIPPAGE_TOLERANCE_LIMIT, WHITELISTED_VAULT_ADDRESSES } from "@/config";
import {
  AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
  GENERAL_ADAPTER_1_ADDRESS,
  MORPHO_BLUE_ADDRESS,
  PARASWAP_ADAPTER_ADDRESS,
} from "@/utils/constants";
import { descaleBigIntToNumber } from "@/utils/format";

import { getParaswapExactBuyQuote, getParaswapExactBuyTxPayload } from "../data/paraswap/getParaswapExactBuy";
import {
  ParaswapExactSellTxPayload,
  getParaswapExactSellQuote,
  getParaswapExactSellTxPayload,
} from "../data/paraswap/getParaswapExactSell";
import { getAaveV3Positions } from "../data/rpc/getAaveV3Positions";
import { getIsContract } from "../data/rpc/getIsContract";
import { getSimulationState } from "../data/rpc/getSimulationState";
import { morphoFlashLoan, paraswapBuy, paraswapSell } from "../utils/bundlerActions";
import { computeScaledAmount } from "../utils/math";

import { inputTransferSubbundle } from "./inputTransferSubbundle";
import { Subbundle } from "./types";

// See: ../docs/aave-wind-down/technical-explination.md for more details
//
// Definitions:
// * AA: aave adapter
// * PA: paraswap adapter
// * GA1: general adapter 1
// * FLA: flash loan asset (USDC)

// Process:
// 1. Flash loan: Take flash loan of F_L in flashLoanAmount from Morpho to PA
// 2. Loan asset swaps: Execute exact output swaps from F_LS to L_i swaps with AA as recipient
// 3. Sweep: Sweep remaining FLA to AA (not consumed by swaps and L_D)
// 4. Repay: Repay AAVE loans with AA
// 5. Sweep: Sweep remaining FLA to GA1 (not consumed by swaps)
// 6. Sweep: If full wind down, sweep any remaining loan assets back to user - this is annoying, but no way around it
// 7. aToken Input Transfer: For each collateral asset, send aTokens into AA (must have been approved to do so)
// 8. Withdraw collateral: For each collateral asset redeem aTokens to withdraw collateral to GA1 if FLA or PA otherwise
// 9. Collateral asset swaps: Execute exact input swaps from C_i to F_CS with GA1 as recipient (full amount)
// 10. Repay flash loan: Repay flash loan with F_C
// 11. Output swap: Swap F_R to output asset
// -> GA1 now holds all remaining value as output asset

interface AaveV3PortfolioWindDownSubbundleParameters {
  publicClient: Client;
  accountAddress: Address;

  portfolioPercentage: number; // (0, 1], percentage of entire portfolio to wind down
  maxSlippageTolerance: number; // (0,MAX_SLIPPAGE_TOLERANCE_LIMIT), this is slippage at the quoted output

  flashLoanAssetAddress: Address; // The asset to use for the flash loan from Morpho, ideally this is highly liquid
  outputAssetAddress: Address; // The single asset which all remaining value will be in
}

// Wind down AAVE V3 portfolio (close borrows and redeem aToken) by portfolioPercentage, leaving remaining value in output assets in GA1
export async function aaveV3PortfolioWindDownSubbundle({
  publicClient,
  accountAddress,

  portfolioPercentage,
  maxSlippageTolerance,

  flashLoanAssetAddress,
  outputAssetAddress,
}: AaveV3PortfolioWindDownSubbundleParameters): Promise<
  Subbundle & { quotedOutputAssets: bigint; minOutputAssets: bigint }
> {
  // Input validation
  if (portfolioPercentage <= 0 || portfolioPercentage > 1) {
    throw new Error("Portfolio percentage must be between 0 (exclusive) and 1 (inclusive)");
  }
  if (maxSlippageTolerance <= 0 || maxSlippageTolerance > MAX_SLIPPAGE_TOLERANCE_LIMIT) {
    throw new Error(`Max slippage tolerance must be between 0 and ${MAX_SLIPPAGE_TOLERANCE_LIMIT}`);
  }

  const [isContract, positions, availableFlashLoanAmount] = await Promise.all([
    getIsContract(publicClient, accountAddress),
    getAaveV3Positions(publicClient, accountAddress),
    readContract(publicClient, {
      address: flashLoanAssetAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [MORPHO_BLUE_ADDRESS],
    }),
  ]);

  const isFullWindDown = portfolioPercentage === 1;

  const loanPositions = positions
    .filter((p) => BigInt(p.borrowBalance) > 0n)
    .map((p) => ({
      ...p,
      migrationAmount: computeScaledAmount(
        p.borrowBalance,
        isFullWindDown ? 1.0003 : portfolioPercentage, // Rebasing margin for full wind down to leftover dust in AAVE
        "Down"
      ),
    }));

  const collateralPositions = positions
    .filter((p) => BigInt(p.supplyBalance) > 0n)
    .map((p) => ({ ...p, migrationAmount: computeScaledAmount(p.supplyBalance, portfolioPercentage, "Down") }));

  if (loanPositions.length == 0 && collateralPositions.length == 0) {
    throw new Error("No positions to wind down");
  }

  // In the case of no loan positons, override flash loan asset address to directly go to the output asset
  if (loanPositions.length == 0) {
    flashLoanAssetAddress = outputAssetAddress;
  }

  const requiresOutputSwapLayer = !isAddressEqual(outputAssetAddress, flashLoanAssetAddress);

  const loanPositionsNotInFlashLoanAsset = loanPositions.filter(
    (p) => !isAddressEqual(p.underlyingAssetAddress, flashLoanAssetAddress)
  );
  const loanPositionInFlashLoanAsset = loanPositions.find((p) =>
    isAddressEqual(p.underlyingAssetAddress, flashLoanAssetAddress)
  );

  const collateralPositionsNotInFlashLoanAsset = collateralPositions.filter(
    (p) => !isAddressEqual(p.underlyingAssetAddress, flashLoanAssetAddress)
  );
  const collateralPositionInFlashLoanAsset = collateralPositions.find((p) =>
    isAddressEqual(p.underlyingAssetAddress, flashLoanAssetAddress)
  );

  // Fetch quotes before tx payload so we can compute slippage
  const loanAssetSwapQuotes = await Promise.all(
    loanPositionsNotInFlashLoanAsset.map((p) =>
      getParaswapExactBuyQuote({
        publicClient,
        accountAddress,

        srcTokenAddress: flashLoanAssetAddress,
        destTokenAddress: p.underlyingAssetAddress,

        exactDestTokenAmount: p.migrationAmount,
      })
    )
  );
  const collateralAssetSwapQuotes = await Promise.all(
    collateralPositionsNotInFlashLoanAsset.map((p) =>
      getParaswapExactSellQuote({
        publicClient,
        accountAddress,

        srcTokenAddress: p.underlyingAssetAddress,
        destTokenAddress: flashLoanAssetAddress,

        // We adjust to be max sell in paraswap call which accounts for rebasing
        exactSrcTokenAmount: p.migrationAmount,
      })
    )
  );
  const flashLoanAssetDecimals = await readContract(publicClient, {
    address: flashLoanAssetAddress,
    abi: erc20Abi,
    functionName: "decimals",
  });

  const F_LS = loanAssetSwapQuotes.reduce((acc, q) => acc + BigInt(q.srcAmount), 0n);
  const L_D = loanPositionInFlashLoanAsset?.migrationAmount ?? 0n;
  const F_L = F_LS + L_D;

  const F_CS = collateralAssetSwapQuotes.reduce((acc, q) => acc + BigInt(q.destAmount), 0n);
  const C_D = collateralPositionInFlashLoanAsset?.migrationAmount ?? 0n;
  const F_C = F_CS + C_D;

  const F_R = F_C - F_L;

  if (F_R <= 0n) {
    throw new Error("Insufficient collateral to repay flash loan");
  }

  const maxSlippageTolerancePerSwap = computePerSwapMaxSlippageToleranceV2(
    maxSlippageTolerance,
    C_D,
    L_D,
    F_CS,
    F_LS,
    flashLoanAssetDecimals,
    requiresOutputSwapLayer
  );

  const loanAssetSwapTxs = await Promise.all(
    loanAssetSwapQuotes.map((q) =>
      getParaswapExactBuyTxPayload({
        publicClient,
        accountAddress,

        srcTokenAddress: getAddress(q.srcToken),
        destTokenAddress: getAddress(q.destToken),

        quote: q,

        exactDestTokenAmount: BigInt(q.destAmount),

        slippageType: "slippage",
        maxSlippage: maxSlippageTolerancePerSwap,
      })
    )
  );

  const collateralAssetSwapTxs = await Promise.all(
    collateralAssetSwapQuotes.map((q) =>
      getParaswapExactSellTxPayload({
        publicClient,
        accountAddress,

        srcTokenAddress: getAddress(q.srcToken),
        destTokenAddress: getAddress(q.destToken),

        quote: q,

        exactSrcTokenAmount: BigInt(q.srcAmount),

        slippageType: "slippage",
        maxSlippage: maxSlippageTolerancePerSwap,
      })
    )
  );

  const maxF_L = loanAssetSwapTxs.reduce((acc, tx) => acc + tx.maxSrcTokenAmount, 0n) + L_D;
  if (maxF_L > availableFlashLoanAmount) {
    throw Error("Insufficient flash loan liquidity.");
  }

  const minF_C = collateralAssetSwapTxs.reduce((acc, tx) => acc + tx.minDestTokenAmount, 0n) + C_D;
  const minF_R = minF_C - maxF_L;

  let quotedOutputAssets: bigint;
  let minOutputAssets: bigint;
  let outputAssetSwapTx: ParaswapExactSellTxPayload | undefined = undefined;
  if (requiresOutputSwapLayer) {
    outputAssetSwapTx = await getParaswapExactSellTxPayload({
      publicClient,
      accountAddress,

      srcTokenAddress: flashLoanAssetAddress,
      destTokenAddress: outputAssetAddress,

      // We adjust to be max sell in paraswap call which accounts for rebasing
      exactSrcTokenAmount: F_R,

      slippageType: "slippage",
      maxSlippage: maxSlippageTolerancePerSwap,
    });

    quotedOutputAssets = outputAssetSwapTx.quoteDestTokenAmount;
    minOutputAssets = outputAssetSwapTx.minDestTokenAmount;
  } else {
    quotedOutputAssets = F_R;
    minOutputAssets = minF_R;
  }

  // Sanity check that the total slippage tolerance is respected
  const actualMaxSlippageTolerance = new Decimal(quotedOutputAssets.toString())
    .div(new Decimal(minOutputAssets.toString()))
    .minus(1)
    .toNumber();

  if (actualMaxSlippageTolerance > maxSlippageTolerance) {
    // Means something is wrong with our computation, this should never happen but if it does abort
    // This is an extra guarentee that we will always respect the users output slippage tolerance
    throw new Error("Estimated slippage exceeds max allowed.");
  }

  const simulationState = await getSimulationState({
    publicClient,
    actionType: "vault",
    accountAddress,
    vaultAddress: WHITELISTED_VAULT_ADDRESSES[0], // Random vault as a placeholder, not relivent here just using for the token holdings
    additionalTokenAddresses: [...collateralPositions.map((p) => p.aTokenAddress), flashLoanAssetAddress],
  });
  const aTokenInputTransferSubbundles = collateralPositions.map((p) =>
    inputTransferSubbundle({
      accountAddress,
      tokenAddress: p.aTokenAddress,
      amount: isFullWindDown ? maxUint256 : p.migrationAmount,
      recipientAddress: AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
      config: {
        accountSupportsSignatures: !isContract,
        tokenIsRebasing: true,
        allowWrappingNativeAssets: false,
      },
      simulationState,
    })
  );

  function getBundlerCalls() {
    const collateralWindDownCalls: BundlerCall[] = [
      // 7. Transfer in aTokens from user to AA
      ...aTokenInputTransferSubbundles.map((s) => s.bundlerCalls()),
      // 8. Withdraw collateral to GA1 for FLA, otherwise to AA
      ...collateralPositions.map((p) => {
        return BundlerAction.aaveV3Withdraw(
          CHAIN_ID,
          p.underlyingAssetAddress,
          maxUint256, // Use max aTokens in AA
          isAddressEqual(p.underlyingAssetAddress, flashLoanAssetAddress)
            ? GENERAL_ADAPTER_1_ADDRESS
            : PARASWAP_ADAPTER_ADDRESS
        );
      }),
      // 9. Execute collateral asset swaps sending to GA1
      ...collateralAssetSwapTxs.map((params) =>
        paraswapSell(
          params.augustus,
          params.calldata,
          params.inputs.srcTokenAddress,
          params.inputs.destTokenAddress,
          true, // Sell entire balance, this accounts for rebasing between quote and execution by scaling quote accordingly
          params.offsets,
          GENERAL_ADAPTER_1_ADDRESS
        )
      ),
      // All remaining flash loan assets will be in GA1
    ].flat();

    const outputSwapCalls: BundlerCall[] = outputAssetSwapTx
      ? [
          // 11. Swap remaining FLA to the output asset
          BundlerAction.erc20Transfer(
            flashLoanAssetAddress,
            PARASWAP_ADAPTER_ADDRESS,
            maxUint256,
            GENERAL_ADAPTER_1_ADDRESS
          ),
          // 11. Swap FLA to output asset sending to GA1
          paraswapSell(
            outputAssetSwapTx.augustus,
            outputAssetSwapTx.calldata,
            outputAssetSwapTx.inputs.srcTokenAddress,
            outputAssetSwapTx.inputs.destTokenAddress,
            true, // Sell entire balance, this accounts for rebasing between quote and execution by scaling quote accordingly
            outputAssetSwapTx.offsets,
            GENERAL_ADAPTER_1_ADDRESS
          ),
        ].flat()
      : [];

    const bundlerCalls: BundlerCall[] =
      maxF_L > 0n
        ? [
            morphoFlashLoan(
              CHAIN_ID,
              flashLoanAssetAddress,
              maxF_L,
              // 1. Flash loan callbacks, must have at least flashLoanAmount in GA1 at the end of these callbacks to repay
              [
                // 1. Transfer flash loan into PA
                BundlerAction.erc20Transfer(
                  flashLoanAssetAddress,
                  PARASWAP_ADAPTER_ADDRESS,
                  maxUint256,
                  GENERAL_ADAPTER_1_ADDRESS
                ),
                // 2. Execute loan asset swaps sending to AA
                ...loanAssetSwapTxs.map((params) =>
                  // FLA -> loan asset
                  paraswapBuy(
                    params.augustus,
                    params.calldata,
                    params.inputs.srcTokenAddress,
                    params.inputs.destTokenAddress,
                    params.offsets,
                    AAVE_V3_MIGRATION_ADAPTER_ADDRESS
                  )
                ),
                // 3. Sweep remainging FLA to AA (not consumed by swaps, or position in FLA)
                BundlerAction.erc20Transfer(
                  flashLoanAssetAddress,
                  AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
                  maxUint256,
                  PARASWAP_ADAPTER_ADDRESS
                ),
                // 4. Repay AAVE loans
                ...loanPositions.map((p) =>
                  BundlerAction.aaveV3Repay(
                    CHAIN_ID,
                    p.underlyingAssetAddress,
                    // If not full wind down, use full amount for all assets except FLA (should be same as migrationAmount, but seen Paraswap give 1 more than exact output)
                    isFullWindDown
                      ? maxUint256
                      : isAddressEqual(p.underlyingAssetAddress, flashLoanAssetAddress)
                        ? p.migrationAmount
                        : maxUint256,
                    accountAddress,
                    2n
                  )
                ),
                // 5. Sweep any remaining FLA to GA1 (not consumed by swaps)
                BundlerAction.erc20Transfer(
                  flashLoanAssetAddress,
                  GENERAL_ADAPTER_1_ADDRESS,
                  maxUint256,
                  AAVE_V3_MIGRATION_ADAPTER_ADDRESS
                ),
                // 6. Sweep any dust non FLA loan assets to user for full wind down (doesn't occur for partial wind down)
                ...(isFullWindDown
                  ? loanPositionsNotInFlashLoanAsset.map((p) =>
                      BundlerAction.erc20Transfer(
                        p.underlyingAssetAddress,
                        accountAddress,
                        maxUint256,
                        AAVE_V3_MIGRATION_ADAPTER_ADDRESS
                      )
                    )
                  : []),
                // steps 7 - 9
                ...collateralWindDownCalls,
              ].flat()
            ),
            // 10. Flash loan will be repaid here (end of flash loan callbacks)

            // 11. Swap to the output asset
            ...outputSwapCalls,
          ].flat()
        : // No loan positions, so just wind down collateral and final swap
          [...collateralWindDownCalls, ...outputSwapCalls].flat();
    return bundlerCalls;
  }

  return {
    signatureRequirements: aTokenInputTransferSubbundles.map((s) => s.signatureRequirements).flat(),
    transactionRequirements: aTokenInputTransferSubbundles.map((s) => s.transactionRequirements).flat(),
    bundlerCalls: getBundlerCalls,
    quotedOutputAssets,
    minOutputAssets,
  };
}

/**
 * Compute the per swap max slippage tolerance to respect the total max slippage as defined on the user output
 * See: ../docs/aave-wind-down/technical-explination.md for more details
 * @param S_T - Total slippage tolerance
 * @param rawC_D - Direct collateral amount (no swap needed)
 * @param rawL_D - Direct loan amount (no swap needed)
 * @param rawF_CS - Collateral swap amount
 * @param rawF_LS - Loan swap amount
 * @param decimals - Decimals of the flash loan asset
 * @param performingOutputSwap - Whether an output swap is being performed
 */
function computePerSwapMaxSlippageToleranceV2(
  S_T: number,
  rawC_D: bigint,
  rawL_D: bigint,
  rawF_CS: bigint,
  rawF_LS: bigint,
  decimals: number,
  performingOutputSwap: boolean
) {
  const C_D = descaleBigIntToNumber(rawC_D, decimals);
  const L_D = descaleBigIntToNumber(rawL_D, decimals);
  const F_CS = descaleBigIntToNumber(rawF_CS, decimals);
  const F_LS = descaleBigIntToNumber(rawF_LS, decimals);

  const F_R = F_CS + C_D - F_LS - L_D;

  // No loan or collateral swaps, so at most there is the output swap layer
  if (F_LS == 0 && F_CS == 0) {
    return S_T;
  }

  let A: number;
  let B: number;
  let C: number;
  if (performingOutputSwap) {
    A = F_R / (1 + S_T) + F_LS;
    B = L_D - C_D;
    C = -F_CS;
  } else {
    A = F_LS;
    B = F_R / (1 + S_T) + L_D - C_D;
    C = -F_CS;
  }

  let S: number;
  if (A == 0) {
    S = -C / B - 1;
  } else {
    S = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A) - 1;
  }

  if (S < 0) {
    // Will never get here, but out of an abundance of caution...
    throw Error("Negative slippage tolerance calculated");
  }

  // Clamp to the total max slippage tolerance
  // It is actually possible that the per swap slippage is allowed to be higher than the total max slippage tolerance if to liquidity mostly already in the flash loan asset (i.e doesn't need swaps).
  // But, let's just be convervative and clamp it to prevent unnecessary slippage
  return Math.min(S, S_T);
}
