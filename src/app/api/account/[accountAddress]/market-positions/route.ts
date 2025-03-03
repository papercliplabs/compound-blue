import { getAccountMarketPositions } from "@/data/whisk/getAccountMarketPositions";
import { getAddress } from "viem";

export async function GET(request: Request, { params }: { params: Promise<{ accountAddress: string }> }) {
  const accountAddress = getAddress((await params).accountAddress);
  const marketPositions = await getAccountMarketPositions(accountAddress);
  return Response.json(marketPositions);
}
