import { SignatureRequest, TransactionRequest } from "@/components/ActionFlowDialog/ActionFlowProvider";
import {
  encodeBundle,
  finalizeBundle,
  InputBundlerOperation,
  populateBundle,
  SignatureRequirement,
  TransactionRequirement,
} from "@morpho-org/bundler-sdk-viem";
import { SimulationState } from "@morpho-org/simulation-sdk";
import { Address } from "viem";

export interface PrepareActionReturnType {
  signatureRequests: SignatureRequest[];
  transactionRequests: TransactionRequest[];
  error?: string;
}

function getSignatureRequirementDescription(
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

function getTransactionRequirementDescription(
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
  simulationState: SimulationState,
  executeBundleName: string
): PrepareActionReturnType {
  try {
    let { operations } = populateBundle(inputOps, simulationState, {});
    operations = finalizeBundle(operations, simulationState, accountAddress);

    console.log("operations", operations);
    const bundle = encodeBundle(operations, simulationState);

    const signatureRequests = bundle.requirements.signatures.map((sig) => ({
      sign: sig.sign,
      name: getSignatureRequirementDescription(sig, simulationState),
    }));
    const transactionRequests = bundle.requirements.txs
      .map((tx) => ({ tx: () => tx.tx, name: getTransactionRequirementDescription(tx, simulationState) }))
      .concat([
        {
          tx: bundle.tx,
          name: executeBundleName,
        },
      ]);

    return { signatureRequests, transactionRequests };
  } catch (e) {
    return {
      signatureRequests: [],
      transactionRequests: [],
      error: `Simulation Error: ${e instanceof Error ? e.message : JSON.stringify(e)}`,
    };
  }
}
