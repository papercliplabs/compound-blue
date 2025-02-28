import { getUserMarketPositions } from "@/data/whisk/getUserMarketPosition";
import { getAddress } from "viem";

export async function GET(request: Request, { params }: { params: Promise<{ accountAddress: string }> }) {
  const accountAddress = getAddress((await params).accountAddress);
  const marketPositions = await getUserMarketPositions(accountAddress);
  return Response.json(marketPositions);
}
