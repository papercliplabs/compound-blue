"use client";
import { ActionFlowButton, ActionFlowDialog, ActionFlowReview } from "@/components/ActionFlowDialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { useAccount, useBalance, usePublicClient } from "wagmi";
import { PrepareVaultSupplyActionReturnType, prepareVaultSupplyBundle } from "@/actions/prepareVaultSupplyAction";
import { getAddress, isAddressEqual, maxUint256, parseUnits } from "viem";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { descaleBigIntToNumber, formatNumber, numberToString } from "@/utils/format";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { VaultActionsProps } from ".";
import { ActionFlowSummary, ActionFlowSummaryAssetItem } from "../ActionFlowDialog/ActionFlowSummary";
import PoweredByMorpho from "../ui/icons/PoweredByMorpho";
import { useAccountTokenHolding } from "@/hooks/useAccountTokenHolding";
import { VAULT_ASSET_CALLOUT } from "@/config";
import { Info } from "lucide-react";
import { MetricChange } from "../MetricChange";
import { WRAPPED_NATIVE_ADDRESS } from "@/utils/constants";
import AssetFormField from "../FormFields/AssetFormField";
import SwitchFormField from "../FormFields/SwitchFormField";

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
  const { data: userNativeBalance } = useBalance({ address });

  const isWrappedNative = useMemo(
    () => isAddressEqual(getAddress(vault.asset.address), WRAPPED_NATIVE_ADDRESS),
    [vault.asset.address]
  );

  const formSchema = useMemo(() => {
    return z
      .object({
        supplyAmount: z
          .string({ required_error: "Amount is required" })
          .nonempty("Amount is required.")
          .pipe(z.coerce.number().positive("Amount must be greater than zero.")),
        isMaxSupply: z.boolean(),
        allowWrappingNativeAssets: z.boolean(),
      })
      .refine(
        (data) => {
          let additionalBalance: number = 0;
          if (isWrappedNative && data.allowWrappingNativeAssets && userNativeBalance) {
            additionalBalance = descaleBigIntToNumber(userNativeBalance.value, userNativeBalance.decimals);
          }

          const maxAmount = userTokenHolding
            ? descaleBigIntToNumber(userTokenHolding.balance, vault.asset.decimals) + additionalBalance
            : undefined;

          return !maxAmount || (maxAmount && maxAmount >= data.supplyAmount);
        },
        {
          message: `Amount exceeds wallet balance.`,
          path: ["supplyAmount"],
        }
      );
  }, [userTokenHolding, userNativeBalance, isWrappedNative, vault.asset.decimals]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      isMaxSupply: false,
      allowWrappingNativeAssets: isWrappedNative,
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

      // Uint256 max if the user wants to supply their entire balance
      const { supplyAmount, isMaxSupply, allowWrappingNativeAssets } = values;
      const supplyAmountBigInt = isMaxSupply
        ? maxUint256
        : parseUnits(numberToString(supplyAmount), vault.asset.decimals);

      const preparedAction = await prepareVaultSupplyBundle({
        publicClient,
        accountAddress: address,
        vaultAddress: getAddress(vault.vaultAddress),
        supplyAmount: supplyAmountBigInt,
        allowWrappingNativeAssets,
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

  const supplyAmount = Number(form.watch("supplyAmount") ?? 0);
  const allowWrappingNativeAssets = Boolean(form.watch("allowWrappingNativeAssets") ?? false);

  // Anytime the allowWrappingNativeAssets changes, trigger the supplyAmount validation since it depends on it
  useEffect(() => {
    // Only if supplyAmount has a value...
    if (form.watch("supplyAmount")) {
      form.trigger("supplyAmount");
    }
  }, [allowWrappingNativeAssets, form]);

  // Includes native if native asset and toggled
  const decaledWalletBalance = useMemo(() => {
    let additionalBalance: number = 0;
    if (isWrappedNative && allowWrappingNativeAssets && userNativeBalance) {
      additionalBalance = descaleBigIntToNumber(userNativeBalance.value, userNativeBalance.decimals);
    }

    return userTokenHolding
      ? descaleBigIntToNumber(userTokenHolding.balance, vault.asset.decimals) + additionalBalance
      : undefined;
  }, [userTokenHolding, vault.asset.decimals, isWrappedNative, userNativeBalance, allowWrappingNativeAssets]);

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
                setIsMax={(isMax) => {
                  form.setValue("isMaxSupply", isMax);
                }}
              />
              {isWrappedNative && (
                <div className="flex rounded-[8px] bg-background-inverse p-3">
                  <SwitchFormField labelContent="Allow Wrapping:" switchLabel="POL" name="allowWrappingNativeAssets" />
                </div>
              )}

              <div className="flex min-w-0 flex-col gap-2">
                <Button type="submit" className="w-full" disabled={simulatingBundle || !form.formState.isValid}>
                  {supplyAmount == 0 ? "Enter Amount" : simulatingBundle ? "Simulating..." : "Review Supply"}
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
              side="supply"
              isIncreasing={true}
              descaledAmount={supplyAmount}
              amountUsd={supplyAmount * vault.asset.priceUsd}
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
          <ActionFlowButton>Supply</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
