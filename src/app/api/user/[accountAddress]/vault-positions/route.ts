import { getUserVaultPositions } from "@/data/whisk/getUserVaultPositions";
import { getAddress } from "viem";

export async function GET(request: Request, { params }: { params: Promise<{ accountAddress: string }> }) {
  const accountAddress = getAddress((await params).accountAddress);
  const vaultPosition = await getUserVaultPositions(accountAddress);
  return Response.json(vaultPosition);
}
