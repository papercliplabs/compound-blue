import { getAaveV3MarketPosition } from "@/data/whisk/getAaveV3MarketPosition";
import { getAddress } from "viem";

export async function GET(request: Request, { params }: { params: Promise<{ accountAddress: string }> }) {
  const accountAddress = getAddress((await params).accountAddress);
  const aaveV3MarketPosition = await getAaveV3MarketPosition(accountAddress);
  return Response.json(aaveV3MarketPosition);
}
