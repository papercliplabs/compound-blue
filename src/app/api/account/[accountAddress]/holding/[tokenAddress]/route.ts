import { getAddress } from "viem";

import { getAccountTokenHolding } from "@/data/whisk/getAccountTokenHolding";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountAddress: string; tokenAddress: string }> }
) {
  const paramValues = await params;
  const accountAddress = getAddress(paramValues.accountAddress);
  const tokenAddress = getAddress(paramValues.tokenAddress);
  const tokenHolding = await getAccountTokenHolding(tokenAddress, accountAddress);
  return Response.json(tokenHolding);
}
