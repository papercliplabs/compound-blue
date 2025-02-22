import { Address, getAddress, Hex } from "viem";

export const CHAIN_ID = 1;

export const WHITELISTED_VAULT_ADDRESSES: Address[] = [
  getAddress("0x974c8FBf4fd795F66B85B73ebC988A51F1A040a9"),
  getAddress("0xdd0f28e19C1780eb6396170735D45153D261490d"),
];

export const WHITELISTED_MARKET_IDS: Hex[] = [
  "0x1eda1b67414336cab3914316cb58339ddaef9e43f939af1fed162a989c98bc20",
  "0xa59b6c3c6d1df322195bfb48ddcdcca1a4c0890540e8ee75815765096c1e8971",
];
