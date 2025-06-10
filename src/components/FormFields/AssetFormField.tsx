"use client";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import { ComponentProps } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

import { descaleBigIntToNumber } from "@/utils/format";

import { Button } from "../ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import NumberFlow from "../ui/NumberFlow";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AssetFormFieldProps<TFieldValues extends Record<string, any>>
  extends Omit<ComponentProps<typeof FormField<TFieldValues>>, "render"> {
  actionName: string;
  asset: {
    symbol: string;
    decimals: number;
    icon?: string | null;
    priceUsd?: number | null;
  };
  setIsMax?: (isMax: boolean) => void;
  rawAvailableBalance?: bigint;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AssetFormField<TFieldValues extends Record<string, any>>({
  actionName,
  asset,
  rawAvailableBalance,
  setIsMax,
  ...props
}: AssetFormFieldProps<TFieldValues>) {
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();

  return (
    <FormField
      {...props}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-4 space-y-0">
          <div className="flex items-center gap-2">
            <FormLabel className="text-accent-secondary">
              {actionName} {asset.symbol}
            </FormLabel>
            <FormMessage />
          </div>
          <div className="flex flex-col">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <FormControl>
                <Input
                  placeholder="0"
                  inputMode="decimal"
                  type="text"
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Validate numeric input and limit decimal places to token's precision
                    if (new RegExp(`^0*(\\d+)?(\\.\\d{0,${asset.decimals}})?$`).test(value)) {
                      field.onChange(value);
                      setIsMax?.(false);
                    }
                  }}
                  value={field.value ?? ""}
                  {...props}
                />
              </FormControl>
              {address && (
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => {
                    if (rawAvailableBalance === undefined) {
                      openConnectModal?.();
                    } else {
                      field.onChange(formatUnits(rawAvailableBalance, asset.decimals));
                      setIsMax?.(true);
                    }
                  }}
                >
                  Max
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between text-content-secondary label-sm">
              {asset.priceUsd && (
                <NumberFlow value={(parseFloat(field.value) || 0) * asset.priceUsd} format={{ currency: "USD" }} />
              )}
              {address && (
                <div className="flex items-center gap-1">
                  {asset.icon && (
                    <Image src={asset.icon} alt={asset.symbol} width={12} height={12} className="rounded-full" />
                  )}
                  <NumberFlow
                    value={
                      rawAvailableBalance != undefined ? descaleBigIntToNumber(rawAvailableBalance, asset.decimals) : 0
                    }
                  />
                  <span>Available</span>
                </div>
              )}
            </div>
          </div>
        </FormItem>
      )}
    />
  );
}

interface AssetFormFieldViewOnlyProps {
  actionName: string;
  asset: {
    symbol: string;
    icon?: string | null;
    priceUsd?: number | null;
  };
  amount: number;
  amountUsd: number;
}

export function AssetFormFieldViewOnly({ actionName, asset, amount, amountUsd }: AssetFormFieldViewOnlyProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[12px]">
      <label className="text-accent-secondary label-sm">
        {actionName} {asset.symbol}
      </label>
      <div className="flex flex-col">
        <NumberFlow value={amount} className="h-[44px] !font-medium title-2" format={{ maximumFractionDigits: 6 }} />
        <NumberFlow value={amountUsd} format={{ currency: "USD" }} className="text-content-secondary label-sm" />
      </div>
    </div>
  );
}
