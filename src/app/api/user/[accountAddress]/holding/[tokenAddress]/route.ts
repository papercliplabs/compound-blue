import { getUserTokenHolding } from "@/data/whisk/getUserTokenHolding";
import { getAddress } from "viem";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountAddress: string; tokenAddress: string }> }
) {
  const paramValues = await params;
  const accountAddress = getAddress(paramValues.accountAddress);
  const tokenAddress = getAddress(paramValues.tokenAddress);
  const marketPositions = await getUserTokenHolding(tokenAddress, accountAddress);
  return Response.json(marketPositions);
}
