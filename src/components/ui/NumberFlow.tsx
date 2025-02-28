import NumberFlowReact from "@number-flow/react";
import { ComponentProps } from "react";

export default function NumberFlow({
  value,
  format,
  ...props
}: { value: number } & ComponentProps<typeof NumberFlowReact>) {
  const {
    notation = "compact",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    currency,
    ...restOptions
  } = format ?? {};

  const formatOptions: typeof format = {
    notation: notation == "compact" && (value > 9999 || value < -9999) ? "compact" : "standard",
    minimumFractionDigits,
    maximumFractionDigits,
    ...restOptions,
  };
  const prefix = currency === "USD" ? "$" : currency === "ETH" ? "Ξ" : "";

  return (
    <span>
      {prefix}
      <NumberFlowReact value={value} format={formatOptions} {...props} className="inline" />
    </span>
  );
}
