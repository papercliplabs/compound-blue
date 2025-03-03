import { getAccountRewards } from "@/data/whisk/getAccountRewards";
import { getAddress } from "viem";

export async function GET(request: Request, { params }: { params: Promise<{ accountAddress: string }> }) {
  const address = getAddress((await params).accountAddress);
  const rewards = await getAccountRewards(address);
  return Response.json(rewards);
}
