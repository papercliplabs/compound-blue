import { Address, Hex, fallback, getAddress, http, parseEther } from "viem";
import { polygon } from "viem/chains";

// Chain the app will support, all addresses below should be on this chain.
export const CHAIN = polygon;
export const TRANSPORTS = fallback([
  http(process.env.NEXT_PUBLIC_RPC_URL_1!),
  http(process.env.NEXT_PUBLIC_RPC_URL_2!),
  http(process.env.NEXT_PUBLIC_RPC_URL_3!),
]);
export const CHAIN_ID = CHAIN.id;
export const BLOCK_EXPLORER_BASE_URL = CHAIN.blockExplorers.default.url;

// Vaults that will show up in earn table and are supported by the app.
export const WHITELISTED_VAULT_ADDRESSES: Address[] = [
  getAddress("0x781FB7F6d845E3bE129289833b04d43Aa8558c42"), // USDC
  getAddress("0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF"), // WETH
  getAddress("0xfD06859A671C21497a2EB8C5E3fEA48De924D6c8"), // USDT
  getAddress("0x3F33F9f7e2D7cfBCBDf8ea8b870a6E3d449664c2"), // POL
];

// Markets that will show up in borrow table and are supported by the app.
export const WHITELISTED_MARKET_IDS: Hex[] = [
  "0xfacd2aaa4ba788e9161c4572a44ce7bbe0944768fac271859d9034f2422e606c", // USDC idle
  "0x1cfe584af3db05c7f39d60e458a87a8b2f6b5d8c6125631984ec489f1d13553b", // WBTC/USDC - 86%
  "0x1947267c49c3629c5ed59c88c411e8cf28c4d2afdb5da046dc8e3846a4761794", // MATICx/USDC - 77%
  "0xa5b7ae7654d5041c28cb621ee93397394c7aee6c6e16c7e0fd030128d87ee1a3", // WETH/USDC - 86%
  "0x7506b33817b57f686e37b87b5d4c5c93fdef4cffd21bbf9291f18b2f29ab0550", // POL/USDC - 77%
  "0xd1485762dd5256b99530b6b07ab9d20c8d31b605dd5f27ad0c6dec2a18179ac6", // compWETH/USDC - 86%
  "0x8513df298cab92cafba1bae394420b7150aa40a5fac649c7168404bd5174a54c", // sACRED/USDC - 77%

  "0x372f25501f88e5e8b9373b8076985870b7c1cbd0903f26a1fef34790dbdb3607", // USDT idle
  "0x2476bb905e3d94acd7b402b3d70d411eeb6ace82afd3007da69a0d5904dfc998", // WBTC/USDT - 86%
  "0x41e537c46cc0e2f82aa69107cd72573f585602d8c33c9b440e08eaba5e8fded1", // MATICx/USDC - 77%
  "0x01550b8779f4ca978fc16591537f3852c02c3491f597db93d9bb299dcbf5ddbe", // WETH/USDT - 86%
  "0x267f344f5af0d85e95f253a2f250985a9fb9fca34a3342299e20c83b6906fc80", // POL/USDT - 77%
  "0xa8c2e5b31d1f3fb6c000bd49355d091f71e7c866fcb74a1cb2562ef67157bc2a", // compWETH/USDT - 86%

  "0x40aa905825a89eda33acce144f9125f6568411154e8166b5c65df31c40e0b999", // WETH idle
  "0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae", // wstETH/WETH - 91.5%
  "0x9eacb622c6ef9c2f0fa5f1fda58a8702eb8132d8f49783f6eea6acc3a398e741", // WBTC/WETH - 86%

  "0x18e2a37b9edab9d06b509a71f43f51d15581d1176aa91cf1a4cdf5ee3102ad37", // POL idle
  "0xa932e0d8a9bf52d45b8feac2584c7738c12cf63ba6dff0e8f199e289fb5ca9bb", // MATICx/POL - 91.5%
  "0x28d8d92f5392c1b26e82dcbec25949ed028ea5b99d5a929ce485f0fd88e47fcc", // WETH/WPOL - 77%
  "0x96e62bd75493006b81dae51d5db3c5af4b3ced65133dab60e70df9dc8e38bf2c", // WBTC/WPOL - 77%
];

// Assets which lack reliability DEX liquidity and routes
export const ASSETS_EXCLUDED_FROM_SWAPS: Address[] = [
  getAddress("0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF"), // compWETH
  getAddress("0x9d60947D49911E3c262C108f97FE07cde209f9a7"), // sACRED
];

// Explicit callouts for a vault asset, this will be placed above the input field for the supply action
// Indexed by underlying asset address
export const VAULT_ASSET_CALLOUT: Record<Address, string> = {
  [getAddress("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359")]: "This vault only supports native USDC.",
};

// Merkl reward distribution contract for reward claiming
export const MERKLE_DISTRIBUTION_ADDRESS = getAddress("0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae");

// The reward tokens to support for distribution
export const MERKL_REWARD_TOKEN_ADDRESSES: Address[] = [
  getAddress("0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"), // WPOL
  getAddress("0x8505b9d2254A7Ae468c0E9dd10Ccea3A837aef5c"), // COMP
];

// [0, 1], Only allow a max borrow origination of up to this % below LLTV
export const MAX_BORROW_LTV_MARGIN = 0.05;

// Target utilization above which the public allocator shared liquidity algorithm is enabled for borrowing (WAD)
export const PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION = BigInt(90_5000000000000000);

// Used to display a name and icon for addresses instead of the raw address in the UI
export const KNOWN_ADDRESSES: Record<Address, { name: string; iconSrc?: string } | undefined> = {
  [getAddress("0x9E33faAE38ff641094fa68c65c2cE600b3410585")]: {
    name: "Gauntlet",
    iconSrc: "/identity/gauntlet.png",
  },
  [getAddress("0xCC3E7c85Bb0EE4f09380e041fee95a0caeDD4a02")]: {
    name: "Compound DAO",
    iconSrc: "/identity/compound.png",
  },
};

export const AAVE_V3_UI_POOL_DATA_PROVIDER_ADDRESS = getAddress("0x68100bD5345eA474D93577127C11F39FF8463e93");
export const AAVE_V3_POOL_ADDRESS = getAddress("0x794a61358D6845594F94dc1DB02A252b5b4814aD");
export const AAVE_V3_POOL_ADDRESS_PROVIDER = getAddress("0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb");

export const PARASWAP_PARTNER_NAME = "compound.blue";
export const PARASWAP_PARTNER_ADDRESS = getAddress("0xCC3E7c85Bb0EE4f09380e041fee95a0caeDD4a02"); // Compoound DAO

// ISO 3166-2: https://en.wikipedia.org/wiki/ISO_3166-2
export const COUNTRY_CODES_TO_DISABLE_LEVERAGE = ["US", "GB"];

// If a user requests max action and wrapping of native asset, leave this much native in their wallet for future gas.
export const MIN_REMAINING_NATIVE_ASSET_BALANCE_AFTER_WRAPPING = parseEther("0.1");

// Limit for the max slippage tolerance users can set (0, 1)
export const MAX_SLIPPAGE_TOLERANCE_LIMIT = 0.5;

export const USDC_ADDRESS = getAddress("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
export const WBTC_ADDRESS = getAddress("0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6");
