import { SignatureRequest, TransactionRequest } from "@/components/ActionFlowDialog/ActionFlowProvider";
import { PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION } from "@/config";
import {
  encodeBundle,
  finalizeBundle,
  InputBundlerOperation,
  populateBundle,
  SignatureRequirement,
  TransactionRequirement,
} from "@morpho-org/bundler-sdk-viem";
import { SimulationResult, SimulationState } from "@morpho-org/simulation-sdk";
import { Address } from "viem";

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
      initialSimulationState?: SimulationResult[number];
      finalSimulationState?: SimulationResult[number];
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

    return {
      status: "success",
      signatureRequests,
      transactionRequests,
      initialSimulationState: bundle.steps?.[0],
      finalSimulationState: bundle.steps?.[bundle.steps.length - 1],
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}
