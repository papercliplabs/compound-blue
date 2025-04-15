import { MarketId } from "@morpho-org/blue-sdk";
import { Address, getAddress } from "viem";

export const WETH_ADDRESS = getAddress("0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619");
export const USDC_ADDRESS = getAddress("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
export const USDT_ADDRESS = getAddress("0xc2132D05D31c914a87C6611C10748AEb04B58e8F");

export const WETH_USDC_MARKET_ID = "0xa5b7ae7654d5041c28cb621ee93397394c7aee6c6e16c7e0fd030128d87ee1a3" as MarketId;
export const WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS: Address[] = [
  getAddress("0x781FB7F6d845E3bE129289833b04d43Aa8558c42"),
];

export const USDC_VAULT_ADDRESS = getAddress("0x781FB7F6d845E3bE129289833b04d43Aa8558c42");

export const TEST_ACCOUNT_1 = getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
export const TEST_SMART_ACCOUNT_1 = getAddress("0x78bA04d47fEc53d1d46f9d928269888a8adaa4E9");
