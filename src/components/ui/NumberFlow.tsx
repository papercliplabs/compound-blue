import NumberFlowReact from "@number-flow/react";
import { ComponentProps } from "react";

const MAX_USD_VALUE = 1e12;

export default function NumberFlow({
  value,
  format,
  className,
  ...props
}: { value: number } & ComponentProps<typeof NumberFlowReact>) {
  const currency = format?.currency;
  const isPercent = format?.style === "percent";
  const {
    notation = "compact",
    minimumFractionDigits = 2,
    maximumFractionDigits = value < 1 && currency !== "USD" && !isPercent ? 3 : 2,
    ...restOptions
  } = format ?? {};

  const formatOptions: typeof format = {
    notation: notation == "compact" && (value > 9999 || value < -9999) ? "compact" : "standard",
    minimumFractionDigits,
    maximumFractionDigits,
    ...restOptions,
  };
  let prefix = currency === "USD" ? "$" : currency === "ETH" ? "Ξ" : "";

  // Clamp to max USD value
  if (currency === "USD" && value > MAX_USD_VALUE) {
    value = MAX_USD_VALUE;
    prefix = ">" + prefix;
  }

  const minDisplayValue = Math.pow(10, -maximumFractionDigits);
  if (value !== 0 && value < minDisplayValue) {
    prefix = "<" + prefix;
    value = minDisplayValue;
  }

  return (
    <span className={className}>
      {prefix}
      <NumberFlowReact value={value} format={formatOptions} {...props} className="inline" />
    </span>
  );
}
