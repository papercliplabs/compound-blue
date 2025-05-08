import { Address, Hex, encodeFunctionData } from "viem";

import { merklDistributorAbi } from "@/abis/merklDistributorAbi";
import { MERKLE_DISTRIBUTION_ADDRESS } from "@/config";

import { Action, TransactionRequest } from "../utils/types";

interface MerklClaimActionParameters {
  accountAddress: Address;
  tokens: Address[];
  amounts: bigint[];
  proofs: Hex[][];
}

export function merklClaimAction({ accountAddress, tokens, amounts, proofs }: MerklClaimActionParameters): Action {
  const len = tokens.length;
  if (amounts.length != len || proofs.length != len) {
    throw new Error("Invalid arguments, must have same length");
  }

  const req: ReturnType<TransactionRequest["tx"]> = {
    to: MERKLE_DISTRIBUTION_ADDRESS,
    data: encodeFunctionData({
      abi: merklDistributorAbi,
      functionName: "claim",
      args: [Array(len).fill(accountAddress), tokens, amounts, proofs],
    }),
    value: BigInt(0),
  };

  return {
    status: "success",
    signatureRequests: [],
    transactionRequests: [
      {
        name: "Claim",
        tx: () => req,
      },
    ],
  };
}
