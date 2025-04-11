import { SignatureRequest, TransactionRequest } from "@/components/ActionFlowDialog/ActionFlowProvider";
import { PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION } from "@/config";
import { getSimulationState } from "@/data/getSimulationState";
import { WAD } from "@/utils/constants";
import { MarketId } from "@morpho-org/blue-sdk";
import {
  encodeBundle,
  finalizeBundle,
  InputBundlerOperation,
  populateBundle,
  SignatureRequirement,
  TransactionRequirement,
} from "@morpho-org/bundler-sdk-viem";
import { MaybeDraft, SimulationResult, SimulationState } from "@morpho-org/simulation-sdk";
import { Address, Client } from "viem";

export type PrepareActionReturnType =
  | {
      status: "success";
      signatureRequests: SignatureRequest[];
      transactionRequests: TransactionRequest[];
    }
  | {
      status: "error";
      message: string;
    };

export type PrepareMorphoActionReturnType =
  | (Extract<PrepareActionReturnType, { status: "success" }> & {
      status: "success";
      initialSimulationState: SimulationResult[number];
      finalSimulationState: SimulationResult[number];
    })
  | Extract<PrepareActionReturnType, { status: "error" }>;

export interface SimulatedValueChange<T> {
  before: T;
  after: T;
}

export function getSignatureRequirementDescription(
  requirement: Omit<SignatureRequirement, "sign">,
  simulationState: SimulationState
): string {
  const action = requirement.action;
  switch (action.type) {
    case "approve2": {
      const tokenAddress = action.args[1].details.token;
      const tokenSymbol = simulationState.tokens[tokenAddress]?.symbol ?? "";
      return `Sign ${tokenSymbol} Permit`;
    }
    case "permit": {
      const tokenAddress = action.args[1];
      const tokenSymbol = simulationState.tokens[tokenAddress]?.symbol ?? "";
      return `Sign ${tokenSymbol} Permit`;
    }
    case "morphoSetAuthorizationWithSig":
      return "Sign Bundler Authorization";
    default:
      return "Sign Message";
  }
}

export function getTransactionRequirementDescription(
  requirement: Omit<TransactionRequirement, "tx">,
  simulationState: SimulationState
): string {
  switch (requirement.type) {
    case "erc20Approve":
      const tokenAddress = requirement.args[0];
      const tokenSymbol = simulationState.tokens[tokenAddress]?.symbol ?? "";
      return `Approve ${tokenSymbol}`;
    case "morphoSetAuthorization":
      return "Authorize Bundler";
  }
}

export function prepareBundle(
  inputOps: InputBundlerOperation[],
  accountAddress: Address,
  isSmartAccount: boolean,
  simulationState: SimulationState,
  executeBundleName: string
): PrepareMorphoActionReturnType {
  try {
    let { operations } = populateBundle(inputOps, simulationState, {
      publicAllocatorOptions: {
        enabled: true,
        defaultSupplyTargetUtilization: PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION,
      },
    });
    operations = finalizeBundle(operations, simulationState, accountAddress);
    const bundle = encodeBundle(operations, simulationState, !isSmartAccount); // Don't support sigantures for smart accounts

    const signatureRequests = bundle.requirements.signatures.map((sig) => ({
      sign: sig.sign.bind(bundle),
      name: getSignatureRequirementDescription(sig, simulationState),
    }));
    const transactionRequests = bundle.requirements.txs
      .map((tx) => ({ tx: () => tx.tx, name: getTransactionRequirementDescription(tx, simulationState) }))
      .concat([
        {
          tx: bundle.tx.bind(bundle),
          name: executeBundleName,
        },
      ]);

    const initialSimulationState = bundle.steps?.[0];
    const finalSimulationState = bundle.steps?.[bundle.steps.length - 1];

    if (!initialSimulationState || !finalSimulationState) {
      return {
        status: "error",
        message: "Simulation Error: Missing simulation state",
      };
    }

    return {
      status: "success",
      signatureRequests,
      transactionRequests,
      initialSimulationState,
      finalSimulationState,
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}

export type MarketPositionChange = {
  positionCollateralChange: SimulatedValueChange<bigint>;
  positionLoanChange: SimulatedValueChange<bigint>;
  positionLtvChange: SimulatedValueChange<bigint>;
};

export function computeMarketPositionChange(
  marketId: MarketId,
  accountAddress: Address,
  initialSimulationState: SimulationState | MaybeDraft<SimulationState>,
  finalSimulationState: SimulationState | MaybeDraft<SimulationState>
): MarketPositionChange {
  const positionBefore = initialSimulationState.getPosition(accountAddress, marketId);
  const positionAfter = finalSimulationState.getPosition(accountAddress, marketId);
  const marketBefore = initialSimulationState.getMarket(marketId);
  const marketAfter = finalSimulationState.getMarket(marketId);

  const ltvBefore = marketBefore.getLtv({
    collateral: positionBefore.collateral,
    borrowShares: positionBefore.borrowShares,
  });
  const ltvAfter = marketAfter.getLtv({
    collateral: positionAfter.collateral,
    borrowShares: positionAfter.borrowShares,
  });

  return {
    positionCollateralChange: {
      before: positionBefore.collateral,
      after: positionAfter.collateral,
    },
    positionLoanChange: {
      before: marketBefore.toBorrowAssets(positionBefore.borrowShares),
      after: marketAfter.toBorrowAssets(positionAfter.borrowShares),
    },
    positionLtvChange: {
      before: ltvBefore ?? BigInt(0),
      after: ltvAfter ?? BigInt(0),
    },
  };
}

// Build the simulation state, and include state for public reallocation if it is required based on the requested borrow amount
export async function getMarketSimulationStateAccountingForPublicReallocation({
  publicClient,
  marketId,
  accountAddress,
  allocatingVaultAddresses,
  requestedBorrowAmount,
}: {
  publicClient: Client;
  marketId: MarketId;
  accountAddress: Address;
  allocatingVaultAddresses: Address[];
  requestedBorrowAmount: bigint;
}) {
  const simulationStateWithoutPublicReallocation = await getSimulationState({
    actionType: "market",
    accountAddress,
    marketId,
    publicClient,
    requiresPublicReallocation: false,
  });

  const market = simulationStateWithoutPublicReallocation.getMarket(marketId);

  const supplyAssets = market.totalSupplyAssets;
  const borrowAssets = market.totalBorrowAssets + requestedBorrowAmount;
  const utilization = supplyAssets > BigInt(0) ? (borrowAssets * WAD) / supplyAssets : BigInt(0);
  const requiresPublicReallocation = utilization > PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION;

  if (!requiresPublicReallocation) {
    return simulationStateWithoutPublicReallocation;
  } else {
    return await getSimulationState({
      actionType: "market",
      accountAddress,
      marketId,
      publicClient,
      allocatingVaultAddresses,
      requiresPublicReallocation: true,
    });
  }
}
