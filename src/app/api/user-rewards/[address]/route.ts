import { getUserRewards } from "@/data/whisk/getUserRewards";
import { getAddress } from "viem";

export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  const address = getAddress((await params).address);
  const rewards = await getUserRewards(address);
  return Response.json(rewards);
}
