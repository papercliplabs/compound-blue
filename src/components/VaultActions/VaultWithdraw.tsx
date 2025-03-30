"use client";
import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowReview,
  ActionFlowSummary,
  ActionFlowSummaryAssetItem,
} from "@/components/ActionFlowDialog";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { useAccount, usePublicClient } from "wagmi";
import { getAddress, maxUint256, parseUnits } from "viem";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { descaleBigIntToNumber, formatNumber, numberToString } from "@/utils/format";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import AssetFormField from "../AssetFormField";
import { VaultActionsProps } from ".";
import { PrepareVaultWithdrawActionReturnType, prepareVaultWithdrawBundle } from "@/actions/prepareVaultWithdrawAction";
import PoweredByMorpho from "../ui/icons/PoweredByMorpho";
import { useAccountVaultPosition } from "@/hooks/useAccountVaultPosition";
import { MetricChange } from "../MetricChange";

export default function VaultWithdraw({
  vault,
  onCloseAfterSuccess,
}: VaultActionsProps & { onCloseAfterSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<PrepareVaultWithdrawActionReturnType | undefined>(undefined);
  const [success, setSuccess] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: vaultPosition } = useAccountVaultPosition(getAddress(vault.vaultAddress));

  const decaledPositionBalance = useMemo(
    () => (vaultPosition ? descaleBigIntToNumber(vaultPosition.supplyAssets, vault.asset.decimals) : undefined),
    [vaultPosition, vault.asset.decimals]
  );

  const formSchema = useMemo(() => {
    return z.object({
      withdrawAmount: z
        .string({ required_error: "Amount is required" })
        .nonempty("Amount is required.")
        .pipe(
          z.coerce
            .number()
            .positive({ message: "Amount must be greater than zero." })
            .max(decaledPositionBalance ?? Number.MAX_VALUE, { message: "Amount exceeds position balance." })
        ),
    });
  }, [decaledPositionBalance]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
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
      const { withdrawAmount } = values;
      const withdrawAmountBigInt =
        withdrawAmount === decaledPositionBalance
          ? maxUint256
          : parseUnits(numberToString(withdrawAmount), vault.asset.decimals);

      const preparedAction = await prepareVaultWithdrawBundle({
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
    [publicClient, address, vault.vaultAddress, vault.asset.decimals, openConnectModal, decaledPositionBalance]
  );

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
    setSuccess(true);
  }, [form, setSuccess]);

  const withdrawAmount = Number(form.watch("withdrawAmount") ?? 0);

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
                descaledAvailableBalance={decaledPositionBalance}
              />

              <div className="flex min-w-0 flex-col gap-2">
                <Button type="submit" className="w-full" disabled={simulatingBundle || !form.formState.isValid}>
                  {withdrawAmount == 0 ? "Enter Amount" : simulatingBundle ? "Simulating..." : "Review Withdraw"}
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
              descaledAmount={withdrawAmount}
              amountUsd={withdrawAmount * vault.asset.priceUsd}
            />
          </ActionFlowSummary>
          <ActionFlowReview>
            <MetricChange
              name={`Position (${vault.asset.symbol})`}
              initialValue={formatNumber(
                descaleBigIntToNumber(preparedAction.positionBalanceChange.before, vault.decimals) *
                  vault.asset.priceUsd,
                { currency: "USD" }
              )}
              finalValue={formatNumber(
                descaleBigIntToNumber(preparedAction.positionBalanceChange.after, vault.decimals) *
                  vault.asset.priceUsd,
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
