import { Address, formatUnits } from "viem";
import { BigIntString } from "./types";

export function formatNumber(
  input: number,
  options: Intl.NumberFormatOptions & {
    currency?: "USD" | "ETH";
  } = {}
) {
  const {
    notation = "compact",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    currency,
    ...restOptions
  } = options;

  const formatOptions: Intl.NumberFormatOptions = {
    notation: notation == "compact" && (input > 9999 || input < -9999) ? "compact" : "standard",
    minimumFractionDigits,
    maximumFractionDigits,
    ...restOptions,
  };

  const formatted = new Intl.NumberFormat("en-US", formatOptions).format(input);
  const prefix = currency === "USD" ? "$" : currency === "ETH" ? "Ξ" : "";

  return `${prefix}${formatted}`;
}

export function descaleBigIntToNumber(value: bigint | BigIntString, decimals: number): number {
  return Number(formatUnits(BigInt(value), decimals));
}

export function formatAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
