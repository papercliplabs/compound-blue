import { getAccountIsOfacSanctioned } from "@/data/whisk/getAccountIsOfacSanctioned";
import { getAddress } from "viem";

export async function GET(request: Request, { params }: { params: Promise<{ accountAddress: string }> }) {
  const accountAddress = getAddress((await params).accountAddress);
  const isOfacSanctioned = await getAccountIsOfacSanctioned(accountAddress);
  return Response.json(isOfacSanctioned);
}
