import { getAddress } from "viem";

import { getAccountRewards } from "@/data/whisk/getAccountRewards";

export async function GET(request: Request, { params }: { params: Promise<{ accountAddress: string }> }) {
  const address = getAddress((await params).accountAddress);
  const rewards = await getAccountRewards(address);
  return Response.json(rewards);
}
