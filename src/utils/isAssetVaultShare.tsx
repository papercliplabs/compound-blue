import { Address } from "viem";

import { WHITELISTED_VAULT_ADDRESSES } from "@/config";

export function isAssetVaultShare(assetAddress: Address) {
  return WHITELISTED_VAULT_ADDRESSES.includes(assetAddress);
}
