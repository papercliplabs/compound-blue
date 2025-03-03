"use client";
import { ComponentProps } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import Image from "next/image";
import NumberFlow from "./ui/NumberFlow";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { numberToString } from "@/utils/format";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AssetFormFieldProps<TFieldValues extends Record<string, any>>
  extends Omit<ComponentProps<typeof FormField<TFieldValues>>, "render"> {
  actionName: string;
  asset: {
    symbol: string;
    icon?: string | null;
    priceUsd?: number | null;
  };
  descaledAvailableBalance?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AssetFormField<TFieldValues extends Record<string, any>>({
  actionName,
  asset,
  descaledAvailableBalance,
  ...props
}: AssetFormFieldProps<TFieldValues>) {
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();

  return (
    <FormField
      {...props}
      render={({ field }) => (
        <FormItem>
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
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^0*(\d+)?(\.\d*)?$/.test(value)) {
                      field.onChange(value);
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
                  disabled={!descaledAvailableBalance && !!address} // Something is wrong if so
                  onClick={() => {
                    if (descaledAvailableBalance === undefined) {
                      openConnectModal?.();
                    } else {
                      field.onChange(numberToString(descaledAvailableBalance));
                    }
                  }}
                >
                  Max
                </Button>
              )}
            </div>
            <div className="label-sm flex items-center justify-between text-content-secondary">
              {asset.priceUsd && (
                <NumberFlow value={(field.value ?? 0) * asset.priceUsd} format={{ currency: "USD" }} />
              )}
              <div className="flex items-center gap-1">
                {asset.icon && (
                  <Image src={asset.icon} alt={asset.symbol} width={12} height={12} className="rounded-full" />
                )}
                <NumberFlow value={descaledAvailableBalance ?? 0} />
                <span>Available</span>
              </div>
            </div>
          </div>
        </FormItem>
      )}
    />
  );
}
