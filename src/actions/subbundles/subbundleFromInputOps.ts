import { BundlerAction, SignatureRequirement, TransactionRequirement } from "@morpho-org/bundler-sdk-viem";
import { encodeBundle, finalizeBundle, populateBundle } from "@morpho-org/bundler-sdk-viem";
import { InputBundlerOperation } from "@morpho-org/bundler-sdk-viem";
import { MaybeDraft, SimulationState } from "@morpho-org/simulation-sdk";
import { Address } from "viem";

import { CHAIN_ID, PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION } from "@/config";

import { Subbundle } from "./types";

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

interface SubbundleFromInputOpsParameters {
  inputOps: InputBundlerOperation[];
  accountAddress: Address;
  accountSupportsSignatures: boolean;
  simulationState: SimulationState;
  throwIfRequirements?: boolean;
}

export function subbundleFromInputOps({
  inputOps,
  accountAddress,
  accountSupportsSignatures,
  simulationState,
  throwIfRequirements = false,
}: SubbundleFromInputOpsParameters): Subbundle & {
  initialSimulationState: MaybeDraft<SimulationState>;
  finalSimulationState: MaybeDraft<SimulationState>;
} {
  let { operations } = populateBundle(inputOps, simulationState, {
    publicAllocatorOptions: {
      enabled: true,
      defaultSupplyTargetUtilization: PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION,
    },
  });
  operations = finalizeBundle(operations, simulationState, accountAddress);
  const bundle = encodeBundle(operations, simulationState, accountSupportsSignatures);

  const signatureRequirements = bundle.requirements.signatures.map((sig) => ({
    sign: sig.sign.bind(bundle),
    name: getSignatureRequirementDescription(sig, simulationState),
  }));
  const transactionRequirements = bundle.requirements.txs.map((tx) => ({
    tx: () => tx.tx,
    name: getTransactionRequirementDescription(tx, simulationState),
  }));

  if (throwIfRequirements && (signatureRequirements.length > 0 || transactionRequirements.length > 0)) {
    throw Error("Should not have requirements.");
  }

  const initialSimulationState = bundle.steps?.[0];
  const finalSimulationState = bundle.steps?.[bundle.steps.length - 1];

  if (!initialSimulationState || !finalSimulationState) {
    throw Error("Simulation Error: Missing simulation state");
  }

  function getBundlerCalls() {
    // Allow for encoding after, so encoded uses signatures from signature requirements
    return bundle.actions.map((action) => BundlerAction.encode(CHAIN_ID, action)).flat();
  }

  return {
    signatureRequirements,
    transactionRequirements,
    bundlerCalls: getBundlerCalls,
    initialSimulationState,
    finalSimulationState,
  };
}
