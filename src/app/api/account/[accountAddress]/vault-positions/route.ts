import { getAccountVaultPositions } from "@/data/whisk/getAccountVaultPositions";
import { getAddress } from "viem";

export async function GET(request: Request, { params }: { params: Promise<{ accountAddress: string }> }) {
  const accountAddress = getAddress((await params).accountAddress);
  const vaultPosition = await getAccountVaultPositions(accountAddress);
  return Response.json(vaultPosition);
}
