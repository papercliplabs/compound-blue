import { getAddress } from "viem";

import { getAccountMarketPositions } from "@/data/whisk/getAccountMarketPositions";

export async function GET(request: Request, { params }: { params: Promise<{ accountAddress: string }> }) {
  const accountAddress = getAddress((await params).accountAddress);
  const marketPositions = await getAccountMarketPositions(accountAddress);
  return Response.json(marketPositions);
}
