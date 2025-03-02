import { Address, encodeFunctionData, Hex } from "viem";
import { PrepareActionReturnType } from "./helpers";
import { TransactionRequest } from "@/components/ActionFlowDialog/ActionFlowProvider";
import { MERKLE_DISTRIBUTION_ADDRESS } from "@/config";
import { merklDistributorAbi } from "@/abis/merklDistributorAbi";

interface PrepareMerklClaimActionParameters {
  accountAddress: Address;
  tokens: Address[];
  amounts: bigint[];
  proofs: Hex[][];
}

export function prepareMerklClaimAction({
  accountAddress,
  tokens,
  amounts,
  proofs,
}: PrepareMerklClaimActionParameters): PrepareActionReturnType {
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
