import { CHAIN_ID } from "@/config";
import { addresses } from "@morpho-org/blue-sdk";

export const WAD = BigInt(10 ** 18);

export const {
  morpho: MORPHO_BLUE_ADDRESS,
  permit2: PERMIT2_ADDRESS,
  bundler3: {
    bundler3: BUNDLER3_ADDRESS,
    aaveV3CoreMigrationAdapter: AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
    generalAdapter1: GENERAL_ADAPTER_1_ADDRESS,
    paraswapAdapter: PARASWAP_ADAPTER_ADDRESS,
  },
} = addresses[CHAIN_ID];
