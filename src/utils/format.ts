import { Address, formatUnits } from "viem";

import { BigIntString } from "./types";

const MAX_USD_VALUE = 1e12;

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions & {
    currency?: "USD" | "ETH";
  } = {}
) {
  const currency = options.currency;
  const isPercent = options.style === "percent";
  const {
    notation = "compact",
    minimumFractionDigits = 2,
    maximumFractionDigits = value < 1 && currency !== "USD" && !isPercent ? 3 : 2,
    style,
    ...restOptions
  } = options;

  const displayValue = style == "percent" ? value * 100 : value;
  const formatOptions: Intl.NumberFormatOptions = {
    notation: notation == "compact" && (displayValue > 9999 || displayValue < -9999) ? "compact" : "standard",
    minimumFractionDigits,
    maximumFractionDigits,
    style: currency ? "currency" : style,
    ...restOptions,
  };

  let prefix = "";

  // Clamp to max USD value
  if (currency === "USD" && value > MAX_USD_VALUE) {
    value = MAX_USD_VALUE;
    prefix = ">" + prefix;
  }

  const minValue = Math.pow(10, -maximumFractionDigits);
  if (value !== 0 && Math.abs(displayValue) < minValue) {
    const neg = value < 0;
    prefix = neg ? ">" : "<" + prefix;
    value = minValue * Math.pow(10, style === "percent" ? -2 : 0) * (neg ? -1 : 1);
  }

  const formatted = new Intl.NumberFormat("en-US", formatOptions).format(value);

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

// Avoid scientific notation for large or small entries
export function numberToString(value: number) {
  return new Intl.NumberFormat("en-US", {
    useGrouping: false,
    maximumFractionDigits: 20,
    minimumFractionDigits: 0,
  }).format(value);
}

export function calculateUsdValue(rawAmount: bigint, decimals: number, priceUsd: number | null | undefined): number {
  if (priceUsd == null || priceUsd == undefined) {
    console.warn("Missing USD price");
    return 0;
  }
  const tokenAmount = descaleBigIntToNumber(rawAmount, decimals);
  return tokenAmount * priceUsd;
}

export function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
