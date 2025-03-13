"use client";
import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowReview,
  ActionFlowReviewItem,
} from "@/components/ActionFlowDialog";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { useAccount, usePublicClient } from "wagmi";
import { PrepareVaultSupplyActionReturnType, prepareVaultSupplyBundle } from "@/actions/prepareVaultSupplyAction";
import { getAddress, maxUint256, parseUnits } from "viem";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { descaleBigIntToNumber, formatNumber, numberToString } from "@/utils/format";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import AssetFormField from "../AssetFormField";
import { VaultActionsProps } from ".";
import { ActionFlowSummary, ActionFlowSummaryAssetItem } from "../ActionFlowDialog/ActionFlowSummary";
import PoweredByMorpho from "../ui/icons/PoweredByMorpho";
import { useAccountTokenHolding } from "@/hooks/useAccountTokenHolding";
import { VAULT_ASSET_CALLOUT } from "@/config";
import { Info } from "lucide-react";

export default function VaultSupply({
  vault,
  onCloseAfterSuccess,
}: VaultActionsProps & { onCloseAfterSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<PrepareVaultSupplyActionReturnType | undefined>(undefined);
  const [success, setSuccess] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: userTokenHolding } = useAccountTokenHolding(getAddress(vault.asset.address));

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
            .positive("Amount must be greater than zero.")
            .max(decaledWalletBalance ?? Number.MAX_VALUE, { message: "Amount exceeds wallet balance." })
        ),
    });
  }, [decaledWalletBalance]);

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

      // Uint256 max if the user wants to supply their entire balance
      const { supplyAmount } = values;
      const supplyAmountBigInt =
        supplyAmount === decaledWalletBalance
          ? maxUint256
          : parseUnits(numberToString(supplyAmount), vault.asset.decimals);

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
    [publicClient, address, vault.vaultAddress, vault.asset.decimals, openConnectModal, decaledWalletBalance]
  );

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
    setSuccess(true);
  }, [form, setSuccess]);

  const supplyAmount = Number(form.watch("supplyAmount") ?? 0);

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={simulatingBundle || open} style={{ all: "unset", width: "100%" }}>
            <div className="flex w-full flex-col gap-7 overflow-hidden">
              {VAULT_ASSET_CALLOUT[getAddress(vault.asset.address)] && (
                <div className="flex gap-2 rounded-[8px] bg-background-secondary p-3 lg:bg-background-inverse">
                  <Info size={16} className="shrink-0 items-center stroke-accent-primary" />
                  <p className="text-content-secondary paragraph-sm">
                    {VAULT_ASSET_CALLOUT[getAddress(vault.asset.address)]}
                  </p>
                </div>
              )}
              <AssetFormField
                control={form.control}
                name="supplyAmount"
                actionName="Supply"
                asset={vault.asset}
                descaledAvailableBalance={decaledWalletBalance}
              />

              <div className="flex min-w-0 flex-col gap-2">
                <Button type="submit" className="w-full" disabled={simulatingBundle || !form.formState.isValid}>
                  {supplyAmount == 0 ? "Enter an Amount" : simulatingBundle ? "Simulating..." : "Review Supply"}
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
              actionName="Supply"
              descaledAmount={supplyAmount}
              amountUsd={supplyAmount * vault.asset.priceUsd}
            />
          </ActionFlowSummary>
          <ActionFlowReview>
            <ActionFlowReviewItem
              name={`Position (${vault.asset.symbol})`}
              valueBefore={formatNumber(
                descaleBigIntToNumber(preparedAction.positionBalanceChange.before, vault.decimals) *
                  vault.asset.priceUsd,
                { currency: "USD" }
              )}
              valueAfter={formatNumber(
                descaleBigIntToNumber(preparedAction.positionBalanceChange.after, vault.decimals) *
                  vault.asset.priceUsd,
                { currency: "USD" }
              )}
            />
          </ActionFlowReview>
          <ActionFlowButton>Supply</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
