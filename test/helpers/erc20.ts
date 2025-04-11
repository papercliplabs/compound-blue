import { AnvilTestClient } from "@morpho-org/test";
import { Address, erc20Abi } from "viem";
import { multicall } from "viem/actions";
import { expect } from "vitest";

export async function getErc20BalanceOf(client: AnvilTestClient, tokenAddress: Address, address: Address) {
  const balance = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  return balance;
}

export async function expectZeroErc20Balances(
  client: AnvilTestClient,
  accountAddresses: Address[],
  tokenAddress: Address
) {
  const balances = await multicall(client, {
    contracts: accountAddresses.map((address) => ({
      abi: erc20Abi,
      address: tokenAddress,
      functionName: "balanceOf",
      args: [address],
    })),
    allowFailure: false,
  });

  balances.forEach((balance) => {
    expect(balance).toEqual(BigInt(0));
  });
}
