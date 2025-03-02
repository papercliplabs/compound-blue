import { getUserRewards } from "@/data/whisk/getUserRewards";
import { getAddress } from "viem";

export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  const address = getAddress((await params).address);
  console.log("HERE");
  const rewards = await getUserRewards(address);
  console.log("DEBUG", rewards);
  return Response.json(rewards);
}
