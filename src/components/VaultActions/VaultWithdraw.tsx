"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { getAddress, maxUint256, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { z } from "zod";

import { VaultWithdrawAction, vaultWithdrawAction } from "@/actions/vault/vaultWithdrawAction";
import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowReview,
  ActionFlowSummary,
  ActionFlowSummaryAssetItem,
} from "@/components/ActionFlowDialog";
import { Form } from "@/components/ui/form";
import { useAccountVaultPosition } from "@/hooks/useAccountVaultPosition";
import { useWatchParseUnits } from "@/hooks/useWatch";
import { calculateUsdValue, formatNumber } from "@/utils/format";

import AssetFormField from "../FormFields/AssetFormField";
import { MetricChange } from "../MetricChange";
import { Button } from "../ui/button";
import PoweredByMorpho from "../ui/icons/PoweredByMorpho";

import { VaultActionsProps } from ".";

export default function VaultWithdraw({
  vault,
  onCloseAfterSuccess,
}: VaultActionsProps & { onCloseAfterSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<VaultWithdrawAction | undefined>(undefined);
  const [success, setSuccess] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: vaultPosition } = useAccountVaultPosition(getAddress(vault.vaultAddress));

  const formSchema = useMemo(() => {
    return z.object({
      withdrawAmount: z
        .string({ required_error: "Amount is required" })
        .nonempty("Amount is required.")
        .refine((val) => !isNaN(parseFloat(val)), "Amount must be a valid number.")
        .refine((val) => parseUnits(val, vault.asset.decimals) > 0n, "Amount must be greater than zero.") // This also catches the case where val is lower than token precision, but we prevent this in ActionFlowSummaryAssetItem
        .refine(
          (val) => {
            if (!vaultPosition) {
              return true;
            }

            const rawWithdrawAmount = parseUnits(val, vault.asset.decimals);
            return rawWithdrawAmount <= BigInt(vaultPosition.supplyAssets);
          },
          { message: "Amount exceeds position balance." }
        ),
      isMaxWithdraw: z.boolean(),
    });
  }, [vaultPosition, vault.asset.decimals]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      withdrawAmount: "",
      isMaxWithdraw: false,
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

      // Uint256 max if the user wants to withdraw their entire balance
      const { withdrawAmount, isMaxWithdraw } = values;
      const withdrawAmountBigInt = isMaxWithdraw ? maxUint256 : parseUnits(withdrawAmount, vault.asset.decimals);

      const preparedAction = await vaultWithdrawAction({
        publicClient,
        accountAddress: address,
        vaultAddress: getAddress(vault.vaultAddress),
        withdrawAmount: withdrawAmountBigInt,
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
    setSuccess(true);
  }, [form, setSuccess]);

  const rawWithdrawAmount = useWatchParseUnits({
    control: form.control,
    name: "withdrawAmount",
    decimals: vault.asset.decimals,
  });

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={simulatingBundle || open} style={{ all: "unset", width: "100%" }}>
            <div className="flex w-full flex-col gap-7 overflow-hidden">
              <AssetFormField
                control={form.control}
                name="withdrawAmount"
                actionName="Withdraw"
                asset={vault.asset}
                rawAvailableBalance={vaultPosition ? BigInt(vaultPosition.supplyAssets) : undefined}
                setIsMax={(isMax) => {
                  form.setValue("isMaxWithdraw", isMax);
                }}
              />

              <div className="flex min-w-0 flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={simulatingBundle || !form.formState.isValid}
                  isLoading={simulatingBundle}
                  loadingMessage="Simulating"
                >
                  {rawWithdrawAmount == 0n ? "Enter Amount" : "Review Withdraw"}
                </Button>
                {preparedAction?.status == "error" && (
                  <p className="max-h-[50px] overflow-y-auto text-semantic-negative paragraph-sm">
                    {preparedAction.message}
                  </p>
                )}
              </div>
              <PoweredByMorpho className="self-center" />
            </div>
          </fieldset>
        </form>
      </Form>

      {preparedAction?.status == "success" && (
        <ActionFlowDialog
          open={open}
          onOpenChange={(open) => {
            setOpen(open);
            if (!open && success) {
              onCloseAfterSuccess?.();
            }
          }}
          signatureRequests={preparedAction?.status == "success" ? preparedAction?.signatureRequests : []}
          transactionRequests={preparedAction?.status == "success" ? preparedAction?.transactionRequests : []}
          flowCompletionCb={onFlowCompletion}
        >
          <ActionFlowSummary>
            <ActionFlowSummaryAssetItem
              asset={vault.asset}
              actionName="Withdraw"
              side="supply"
              isIncreasing={false}
              rawAmount={rawWithdrawAmount}
            />
          </ActionFlowSummary>
          <ActionFlowReview>
            <MetricChange
              name={`Position (${vault.asset.symbol})`}
              initialValue={formatNumber(
                calculateUsdValue(
                  preparedAction.positionBalanceChange.before,
                  vault.asset.decimals,
                  vault.asset.priceUsd
                ),
                { currency: "USD" }
              )}
              finalValue={formatNumber(
                calculateUsdValue(
                  preparedAction.positionBalanceChange.after,
                  vault.asset.decimals,
                  vault.asset.priceUsd
                ),
                { currency: "USD" }
              )}
            />
          </ActionFlowReview>
          <ActionFlowButton>Withdraw</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
