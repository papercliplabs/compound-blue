import { addresses } from "@morpho-org/blue-sdk";

import { CHAIN_ID } from "@/config";

import { requireValue } from "./require";

export const WAD = BigInt(10 ** 18);

const {
  morpho,
  permit2,
  bundler3: { bundler3, aaveV3CoreMigrationAdapter, generalAdapter1, paraswapAdapter },
  wNative,
} = addresses[CHAIN_ID];

export const MORPHO_BLUE_ADDRESS = morpho;
export const PERMIT2_ADDRESS = requireValue(permit2, "PERMIT2_ADDRESS");
export const BUNDLER3_ADDRESS = bundler3;
export const AAVE_V3_MIGRATION_ADAPTER_ADDRESS = requireValue(
  aaveV3CoreMigrationAdapter,
  "AAVE_V3_MIGRATION_ADAPTER_ADDRESS"
);
export const GENERAL_ADAPTER_1_ADDRESS = requireValue(generalAdapter1, "GENERAL_ADAPTER_1_ADDRESS");
export const PARASWAP_ADAPTER_ADDRESS = requireValue(paraswapAdapter, "PARASWAP_ADAPTER_ADDRESS");
export const WRAPPED_NATIVE_ADDRESS = requireValue(wNative, "WRAPPED_NATIVE_ADDRESS");

export const SUPPORTED_ADDAPTERS = [
  GENERAL_ADAPTER_1_ADDRESS,
  AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
  PARASWAP_ADAPTER_ADDRESS,
];
