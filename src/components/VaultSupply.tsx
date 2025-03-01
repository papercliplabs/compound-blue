"use client";
import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowError,
  ActionFlowReview,
  ActionFlowSummary,
} from "@/components/ActionFlowDialog";
import { useCallback, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { useAccount, usePublicClient } from "wagmi";
import { PrepareVaultSupplyActionReturnType, prepareVaultSupplyBundle } from "@/actions/prepareVaultSupplyAction";
import { useUserTokenHolding } from "@/providers/UserPositionProvider";
import { Vault } from "@/data/whisk/getVault";
import { getAddress, parseUnits } from "viem";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";
import NumberFlow from "./ui/NumberFlow";
import Image from "next/image";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowRight } from "lucide-react";

interface VaultSupplyProps {
  vault: Vault;
}

export default function VaultSupply({ vault }: VaultSupplyProps) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<PrepareVaultSupplyActionReturnType | undefined>(undefined);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: userTokenHolding } = useUserTokenHolding(getAddress(vault.asset.address));

  const decaledWalletBalance = useMemo(
    () => (userTokenHolding ? descaleBigIntToNumber(userTokenHolding.balance, vault.asset.decimals) : undefined),
    [userTokenHolding, vault.asset.decimals]
  );

  const formSchema = useMemo(() => {
    return z.object({
      supplyAmount: z
        .string({ required_error: "Amount is required" })
        .nonempty("Amount is required.")
        .pipe(
          z.coerce
            .number()
            .nonnegative()
            .max(decaledWalletBalance ?? Number.MAX_VALUE, { message: "Amount exceeds wallet balance." })
        ),
    });
  }, [decaledWalletBalance]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplyAmount: undefined,
    },
  });

  const onSubmit = useCallback(
    async (values: z.infer<typeof formSchema>) => {
      if (!address) {
        openConnectModal?.();
        return;
      }

      if (!publicClient) {
        // Should never get here...
        throw new Error("Missing pulic client");
      }

      setSimulatingBundle(true);

      const { supplyAmount } = values;
      const supplyAmountBigInt = parseUnits(supplyAmount.toString(), vault.asset.decimals);

      const preparedAction = await prepareVaultSupplyBundle({
        publicClient,
        accountAddress: address,
        vaultAddress: getAddress(vault.vaultAddress),
        supplyAmount: supplyAmountBigInt,
      });

      setPreparedAction(preparedAction);

      if (preparedAction.status === "success") {
        setOpen(true);
      }

      setSimulatingBundle(false);
    },
    [publicClient, address, vault.vaultAddress, vault.asset.decimals, openConnectModal]
  );

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
  }, [form]);

  const supplyAmount = form.watch("supplyAmount");

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset
            disabled={simulatingBundle || open}
            style={{ all: "unset" }}
            className="flex w-full flex-col space-y-8 overflow-hidden"
          >
            <FormField
              control={form.control}
              name="supplyAmount"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel className="text-accent-secondary">Supply {vault.asset.symbol}</FormLabel>
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
                            if (value === "" || /^(0?\.\d*|0|[1-9]\d*\.?\d*)$/.test(value)) {
                              field.onChange(value);
                            }
                          }}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        disabled={!decaledWalletBalance && !!address} // Something is wrong if so
                        onClick={() => {
                          if (!decaledWalletBalance) {
                            openConnectModal?.();
                          } else {
                            field.onChange(decaledWalletBalance.toString());
                          }
                        }}
                      >
                        Max
                      </Button>
                    </div>
                    <div className="flex items-center justify-between font-semibold text-content-secondary paragraph-sm">
                      {vault.asset.priceUsd && (
                        <NumberFlow value={(field.value ?? 0) * vault.asset.priceUsd} format={{ currency: "USD" }} />
                      )}
                      <div className="flex items-center gap-1">
                        {vault.asset.icon && (
                          <Image
                            src={vault.asset.icon}
                            alt={vault.asset.symbol}
                            width={12}
                            height={12}
                            className="rounded-full"
                          />
                        )}
                        <NumberFlow value={decaledWalletBalance ?? 0} format={{ maximumFractionDigits: 4 }} />
                        <span>Available</span>
                      </div>
                    </div>
                  </div>
                </FormItem>
              )}
            />
            <div className="flex min-w-0 flex-col gap-2">
              <Button type="submit" className="w-full" disabled={simulatingBundle}>
                {simulatingBundle ? "Simulating..." : "Review Supply"}
              </Button>
              {preparedAction?.status == "error" && (
                <p className="max-h-[50px] overflow-y-auto font-medium text-semantic-negative paragraph-sm">
                  {preparedAction.message}
                </p>
              )}
            </div>
          </fieldset>
        </form>
      </Form>

      {preparedAction?.status == "success" && (
        <ActionFlowDialog
          open={open}
          onOpenChange={setOpen}
          signatureRequests={preparedAction?.status == "success" ? preparedAction?.signatureRequests : []}
          transactionRequests={preparedAction?.status == "success" ? preparedAction?.transactionRequests : []}
          flowCompletionCb={onFlowCompletion}
        >
          <ActionFlowSummary>
            <div className="flex w-full items-center justify-between gap-3 rounded-[10px] bg-background-secondary px-4 py-3 font-semibold">
              <div className="flex items-center gap-2">
                {vault.asset.icon && <Image src={vault.asset.icon} width={32} height={32} alt={vault.asset.symbol} />}
                <span>Supply {vault.asset.symbol}</span>
              </div>
              <div className="flex flex-col items-end">
                <span>{formatNumber(supplyAmount)}</span>
                <span className="text-content-secondary paragraph-sm">
                  {formatNumber(supplyAmount * vault.asset.priceUsd, { currency: "USD" })}
                </span>
              </div>
            </div>
          </ActionFlowSummary>
          <ActionFlowReview className="flex flex-col gap-4 font-semibold">
            <div className="flex items-center justify-between">
              <span>Supplied ({vault.asset.symbol})</span>
              <div className="flex items-center gap-1">
                <span className="text-content-secondary">
                  {formatNumber(
                    descaleBigIntToNumber(preparedAction.positionBalanceBefore, vault.decimals) * vault.asset.priceUsd,
                    { currency: "USD" }
                  )}
                </span>

                <ArrowRight size={14} className="stroke-content-secondary" />

                {formatNumber(
                  descaleBigIntToNumber(preparedAction.positionBalanceAfter, vault.decimals) * vault.asset.priceUsd,
                  { currency: "USD" }
                )}
              </div>
            </div>
          </ActionFlowReview>
          <div className="flex w-full flex-col gap-2">
            <ActionFlowButton>Supply</ActionFlowButton>
            <ActionFlowError />
          </div>
        </ActionFlowDialog>
      )}
    </>
  );
}
