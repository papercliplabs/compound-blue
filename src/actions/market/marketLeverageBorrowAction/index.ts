import { DEFAULT_SLIPPAGE_TOLERANCE, MarketId, MathLib } from "@morpho-org/blue-sdk";
import { fetchMarket } from "@morpho-org/blue-sdk-viem";
import { BundlerAction, BundlerCall, encodeBundle } from "@morpho-org/bundler-sdk-viem";
import { populateSubBundle } from "@morpho-org/bundler-sdk-viem";
import { Address, Client, maxUint256 } from "viem";

import { getParaswapExactBuyTxPayload } from "@/actions/data/paraswap/getParaswapExactBuy";
import { getIsContract } from "@/actions/data/rpc/getIsContract";
import { getMarketSimulationStateAccountingForPublicReallocation } from "@/actions/data/rpc/getSimulationState";
import { inputTransferSubbundle } from "@/actions/subbundles/inputTransferSubbundle";
import { getTransactionRequirementDescription } from "@/actions/subbundles/subbundleFromInputOps";
import { getSignatureRequirementDescription } from "@/actions/subbundles/subbundleFromInputOps";
import { createBundle, paraswapBuy } from "@/actions/utils/bundlerActions";
import { SimulatedValueChange } from "@/actions/utils/positionChange";
import { Action } from "@/actions/utils/types";
import { CHAIN_ID } from "@/config";
import { GENERAL_ADAPTER_1_ADDRESS, MORPHO_BLUE_ADDRESS, PARASWAP_ADAPTER_ADDRESS } from "@/utils/constants";

import { computeLeverageValues } from "./computeLeverageValues";

interface MarketLeveragedBorrowActionParameters {
  publicClient: Client;
  marketId: MarketId;
  allocatingVaultAddresses: Address[];

  accountAddress: Address;

  initialCollateralAmount: bigint; // a.k.a margin
  leverageFactor: number; // (1, (1 + S) / (1 + S - LLTV_WITH_MARGIN))]
  maxSlippageTolerance: number; // (0,1)
}

export type MarketLeveragedBorrowAction =
  | (Extract<Action, { status: "success" }> & {
      positionCollateralChange: SimulatedValueChange<bigint>;
      positionLoanChange: SimulatedValueChange<bigint>;
      positionLtvChange: SimulatedValueChange<bigint>;
    })
  | Extract<Action, { status: "error" }>;

export async function marketLeveragedBorrowAction({
  publicClient,
  marketId,
  allocatingVaultAddresses,

  accountAddress,

  initialCollateralAmount,
  leverageFactor,
  maxSlippageTolerance,
}: MarketLeveragedBorrowActionParameters): Promise<MarketLeveragedBorrowAction> {
  // Disallow maxUint256, we require exact collateral amount
  if (initialCollateralAmount >= maxUint256) {
    return {
      status: "error",
      message: "Initial collateral amount cannot be greater than or equal to max uint256",
    };
  }

  // Other input validation performed within computeLeverageValues

  let market = await fetchMarket(marketId, publicClient);
  const { collateralToken: collateralTokenAddress, loanToken: loanTokenAddress } = market.params;

  let collateralAmount: bigint;
  let loanAmount: bigint;
  try {
    const values = computeLeverageValues(initialCollateralAmount, leverageFactor, maxSlippageTolerance, market);
    collateralAmount = values.collateralAmount;
    loanAmount = values.loanAmount;
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : "An unknown error occurred",
    };
  }

  const [simulationState, isContract] = await Promise.all([
    getMarketSimulationStateAccountingForPublicReallocation({
      accountAddress,
      marketId,
      publicClient,
      allocatingVaultAddresses,
      requestedBorrowAmount: loanAmount,
    }),
    getIsContract(publicClient, accountAddress),
  ]);
  market = simulationState.getMarket(marketId);

  const accountPosition = simulationState.getPosition(accountAddress, marketId);

  const positionCollateralBefore = accountPosition.collateral;
  const positionLoanBefore = market.toBorrowAssets(accountPosition.borrowShares);
  const positionLtvBefore = market.getLtv(accountPosition) ?? 0n;

  const requiredSwapCollateralAmount = collateralAmount - initialCollateralAmount;

  try {
    const inputSubbundle = inputTransferSubbundle({
      accountAddress,
      tokenAddress: collateralTokenAddress,
      amount: initialCollateralAmount,
      recipientAddress: GENERAL_ADAPTER_1_ADDRESS,
      config: {
        accountSupportsSignatures: !isContract,
        tokenIsRebasing: false,
        allowWrappingNativeAssets: false,
      },
      simulationState,
    });

    // Simulate the state changes for actions not supported by the Morpho SDK
    accountPosition.collateral += collateralAmount;

    const borrowSubBundle = populateSubBundle(
      {
        type: "Blue_Borrow",
        sender: accountAddress,
        address: MORPHO_BLUE_ADDRESS,
        args: {
          id: marketId,
          onBehalf: accountAddress,
          receiver: PARASWAP_ADAPTER_ADDRESS,
          assets: loanAmount,
          slippage: DEFAULT_SLIPPAGE_TOLERANCE, // On share price, diff from swap slippage
        },
      },
      simulationState,
      {
        publicAllocatorOptions: {
          enabled: true,
        },
      }
    );

    const borrowSubBundleEncoded = encodeBundle(borrowSubBundle, simulationState, !isContract);

    const paraswapQuote = await getParaswapExactBuyTxPayload({
      publicClient: publicClient,
      accountAddress: PARASWAP_ADAPTER_ADDRESS, // User is the paraswap adapter
      srcTokenAddress: loanTokenAddress,
      destTokenAddress: collateralTokenAddress,
      slippageType: "max-input",
      maxSrcTokenAmount: loanAmount,
      exactDestTokenAmount: requiredSwapCollateralAmount,
    });

    // Just used for dust, priced based on WAD assets
    const maxSharePriceE27 = MathLib.mulDivUp(
      MathLib.WAD,
      MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE),
      market.toBorrowShares(MathLib.WAD)
    );

    function getBundleTx() {
      const encodedBorrowBundlerCalls = borrowSubBundleEncoded.actions.map((action) =>
        BundlerAction.encode(CHAIN_ID, action)
      );

      const bundlerCalls: BundlerCall[] = [
        // Move margin from user into GA1
        ...inputSubbundle.bundlerCalls(),
        BundlerAction.morphoSupplyCollateral(
          CHAIN_ID,
          market.params,
          collateralAmount,
          accountAddress,
          // Supply collateral callbacks, all actions will happen before Morpho pulls the required collateral from GA1 (i.e must have required collateral in GA1 at the end of these callbacks)
          [
            // Take borrow against collateral sending to paraswap adapter.
            ...encodedBorrowBundlerCalls,
            // Use Paraswap adapter to Buy "exact" (can have surplus) amount of collateral needed using loan tokens, sending output to GA1
            paraswapBuy(
              paraswapQuote.augustus,
              paraswapQuote.calldata,
              loanTokenAddress,
              collateralTokenAddress,
              paraswapQuote.offsets,
              GENERAL_ADAPTER_1_ADDRESS
            ),
            // Sweep any remaing loan tokens from Paraswap adapter back to GA1
            BundlerAction.erc20Transfer(
              loanTokenAddress,
              GENERAL_ADAPTER_1_ADDRESS,
              maxUint256,
              PARASWAP_ADAPTER_ADDRESS
            ),
          ].flat()
        ),
        // Collateral will be withdrawn from GA1 here to complete the supply collateral

        // Sweep any remaining collateral from GA1 to user, including any swap surplus.
        BundlerAction.erc20Transfer(collateralTokenAddress, accountAddress, maxUint256, GENERAL_ADAPTER_1_ADDRESS),

        // Use any leftover loan tokens in GA1 to repay the loan to lower LTV
        BundlerAction.morphoRepay(CHAIN_ID, market.params, maxUint256, 0n, maxSharePriceE27, accountAddress, [], true),
      ].flat();

      return createBundle(bundlerCalls);
    }

    const simulationStateAfter = borrowSubBundleEncoded.steps?.[borrowSubBundleEncoded.steps.length - 1];
    const marketAfter = simulationStateAfter?.getMarket(marketId);
    const userPositionAfter = simulationStateAfter?.getPosition(accountAddress, marketId);

    return {
      status: "success",
      signatureRequests: [
        ...inputSubbundle.signatureRequirements,
        ...borrowSubBundleEncoded.requirements.signatures.map((sig) => ({
          sign: sig.sign,
          name: getSignatureRequirementDescription(sig, simulationState),
        })),
      ],
      transactionRequests: [
        ...inputSubbundle.transactionRequirements,
        ...borrowSubBundleEncoded.requirements.txs.map((tx) => ({
          tx: () => tx.tx,
          name: getTransactionRequirementDescription(tx, simulationState),
        })),
        {
          name: "Confirm Multiply",
          tx: getBundleTx,
        },
      ],
      positionCollateralChange: {
        before: positionCollateralBefore,
        after: userPositionAfter?.collateral ?? 0n,
        delta: (userPositionAfter?.collateral ?? 0n) - positionCollateralBefore,
      },
      positionLoanChange: {
        before: positionLoanBefore,
        after: marketAfter?.toBorrowAssets(userPositionAfter?.borrowShares ?? 0n) ?? 0n,
        delta: (marketAfter?.toBorrowAssets(userPositionAfter?.borrowShares ?? 0n) ?? 0n) - positionLoanBefore,
      },
      positionLtvChange: {
        before: positionLtvBefore,
        after: marketAfter?.getLtv(userPositionAfter ?? { collateral: 0n, borrowShares: 0n }) ?? 0n,
        delta:
          (marketAfter?.getLtv(userPositionAfter ?? { collateral: 0n, borrowShares: 0n }) ?? 0n) - positionLtvBefore,
      },
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}
