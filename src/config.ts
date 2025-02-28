import { Address, getAddress, Hex } from "viem";
import { polygon } from "viem/chains";

// export const CHAIN_ID = base.id;

// export const WHITELISTED_VAULT_ADDRESSES: Address[] = [
//   getAddress("0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A"),
//   // getAddress("0xa0E430870c4604CcfC7B38Ca7845B1FF653D0ff1"),
// ];

// export const WHITELISTED_MARKET_IDS: Hex[] = ["0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836"];

export const CHAIN_ID = polygon.id;

export const BLOCK_EXPLORER_BASE_URL = "https://polygonscan.com";

export const WHITELISTED_VAULT_ADDRESSES: Address[] = [
  getAddress("0x781fb7f6d845e3be129289833b04d43aa8558c42"), // USDC
  getAddress("0x3f33f9f7e2d7cfbcbdf8ea8b870a6e3d449664c2"), // POL
  getAddress("0xf5c81d25ee174d83f1fd202ca94ae6070d073ccf"), // WETH
  getAddress("0xfd06859a671c21497a2eb8c5e3fea48de924d6c8"), // USDT
  getAddress("0x27d6a7f9078104135b19d3b196d38316399a71a1"), // Morpho TEST
];

export const WHITELISTED_MARKET_IDS: Hex[] = [
  "0x01550b8779f4ca978fc16591537f3852c02c3491f597db93d9bb299dcbf5ddbe",
  "0x1947267c49c3629c5ed59c88c411e8cf28c4d2afdb5da046dc8e3846a4761794",
  "0x1cfe584af3db05c7f39d60e458a87a8b2f6b5d8c6125631984ec489f1d13553b",
  "0x2476bb905e3d94acd7b402b3d70d411eeb6ace82afd3007da69a0d5904dfc998",
  "0x267f344f5af0d85e95f253a2f250985a9fb9fca34a3342299e20c83b6906fc80",
  "0x41e537c46cc0e2f82aa69107cd72573f585602d8c33c9b440e08eaba5e8fded1",
  "0x7506b33817b57f686e37b87b5d4c5c93fdef4cffd21bbf9291f18b2f29ab0550",
  "0x88a2953e642f96afcb8d8ba2a1cc2e732e9ba89bb99eecf2d6101ad558ab7698",
  "0x9eacb622c6ef9c2f0fa5f1fda58a8702eb8132d8f49783f6eea6acc3a398e741",
  "0xa5b7ae7654d5041c28cb621ee93397394c7aee6c6e16c7e0fd030128d87ee1a3",
  "0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae",
  "0xe558a51e10f1fdf7156c9470d2f68b93b3fd1ad5e775c020ae4a7f805e8d5674",
  // "0x372f25501f88e5e8b9373b8076985870b7c1cbd0903f26a1fef34790dbdb3607",
];
