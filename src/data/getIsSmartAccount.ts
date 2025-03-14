import { Address, Client } from "viem";
import { getCode } from "viem/actions";

export async function getIsSmartAccount(client: Client, accountAddress: Address) {
  const code = await getCode(client, { address: accountAddress });
  return code != undefined;
}
