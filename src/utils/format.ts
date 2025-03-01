import { Address, formatUnits } from "viem";
import { BigIntString } from "./types";

export function formatNumber(
  input: number,
  options: Intl.NumberFormatOptions & {
    currency?: "USD" | "ETH";
  } = {}
) {
  const currency = options.currency;
  const isPercent = options.style === "percent";
  const {
    notation = "compact",
    minimumFractionDigits = 2,
    maximumFractionDigits = input < 1 && currency !== "USD" && !isPercent ? 4 : 2,
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

// Rounds down to 8 decimal places to prevent lost precision from being a larger value
export function descaleBigIntToNumber(value: bigint | BigIntString, decimals: number): number {
  const formattedUnits = formatUnits(BigInt(value), decimals);
  return Math.floor(Number(formattedUnits) * 1e8) / 1e8; // Round down to 8 decimal places for precision
}

export function formatAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
