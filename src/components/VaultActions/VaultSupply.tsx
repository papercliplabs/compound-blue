"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { getAddress, isAddressEqual, maxUint256, parseUnits } from "viem";
import { useAccount, useBalance, usePublicClient } from "wagmi";
import { z } from "zod";

import { VaultSupplyAction, vaultSupplyBundle } from "@/actions/vault/vaultSupplyAction";
import { ActionFlowButton, ActionFlowDialog, ActionFlowReview } from "@/components/ActionFlowDialog";
import { Form } from "@/components/ui/form";
import { MIN_REMAINING_NATIVE_ASSET_BALANCE_AFTER_WRAPPING, VAULT_ASSET_CALLOUT } from "@/config";
import { useAccountTokenHolding } from "@/hooks/useAccountTokenHolding";
import { useWatchParseUnits } from "@/hooks/useWatch";
import { bigIntMax } from "@/utils/bigint";
import { WRAPPED_NATIVE_ADDRESS } from "@/utils/constants";
import { calculateUsdValue, formatNumber } from "@/utils/format";

import { ActionFlowSummary, ActionFlowSummaryAssetItem } from "../ActionFlowDialog/ActionFlowSummary";
import AssetFormField from "../FormFields/AssetFormField";
import SwitchFormField from "../FormFields/SwitchFormField";
import { LowNetworkTokenBalanceWarning } from "../LowNetworkTokenBalanceWarning";
import { MetricChange } from "../MetricChange";
import { Button } from "../ui/button";
import PoweredByMorpho from "../ui/icons/PoweredByMorpho";

import { VaultActionsProps } from ".";

// Small tolerance on when to show gas buffer warning to avoid floating point issues
const GAS_BUFFER_WARNING_TOLERANCE = parseUnits("0.0001", 18);

export default function VaultSupply({
  vault,
  onCloseAfterSuccess,
}: VaultActionsProps & { onCloseAfterSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<VaultSupplyAction | undefined>(undefined);
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

  const computeRawAvailableBalance = useCallback(
    (allowWrappingNativeAssets: boolean) => {
      if (userTokenHolding == undefined || userNativeBalance == undefined) {
        return undefined;
      }

      const additionalBalance: bigint =
        isWrappedNative && allowWrappingNativeAssets
          ? bigIntMax(userNativeBalance.value - MIN_REMAINING_NATIVE_ASSET_BALANCE_AFTER_WRAPPING, 0n)
          : 0n;
      return BigInt(userTokenHolding.balance) + additionalBalance;
    },
    [userTokenHolding, userNativeBalance, isWrappedNative]
  );

  const formSchema = useMemo(() => {
    return z
      .object({
        supplyAmount: z
          .string({ required_error: "Amount is required" })
          .nonempty("Amount is required.")
          .refine((val) => !isNaN(parseFloat(val)), "Amount must be a valid number.")
          .refine((val) => parseUnits(val, vault.asset.decimals) > 0n, "Amount must be greater than zero."), // This also catches the case where val is lower than token precision, but we prevent this in ActionFlowSummaryAssetItem
        isMaxSupply: z.boolean(),
        allowWrappingNativeAssets: z.boolean(),
      })
      .superRefine((data, ctx) => {
        const rawAvailableBalance = computeRawAvailableBalance(data.allowWrappingNativeAssets);
        const rawSupplyAmount = parseUnits(data.supplyAmount, vault.asset.decimals);

        if (rawAvailableBalance != undefined && rawSupplyAmount > rawAvailableBalance) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Amount exceeds ${rawAvailableBalance > BigInt(userTokenHolding?.balance ?? "0") ? "usable " : ""}wallet balance.`,
            path: ["supplyAmount"],
          });
        }
      });
  }, [computeRawAvailableBalance, vault.asset.decimals, userTokenHolding]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplyAmount: "",
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
        throw new Error("Missing public client");
      }

      setSimulatingBundle(true);

      // Uint256 max if the user wants to supply their entire balance
      const { supplyAmount, isMaxSupply, allowWrappingNativeAssets } = values;
      const rawSupplyAmount = isMaxSupply ? maxUint256 : parseUnits(supplyAmount, vault.asset.decimals);

      const preparedAction = await vaultSupplyBundle({
        publicClient,
        accountAddress: address,
        vaultAddress: getAddress(vault.vaultAddress),
        supplyAmount: rawSupplyAmount,
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

  const rawSupplyAmount = useWatchParseUnits({
    control: form.control,
    name: "supplyAmount",
    decimals: vault.asset.decimals,
  });
  const allowWrappingNativeAssets = Boolean(form.watch("allowWrappingNativeAssets") ?? false);

  // Anytime the allowWrappingNativeAssets changes, trigger the supplyAmount validation since it depends on it
  useEffect(() => {
    // Only if supplyAmount has a value...
    if (form.watch("supplyAmount")) {
      void form.trigger("supplyAmount");
    }
  }, [allowWrappingNativeAssets, form]);

  const shouldShowLowNetworkTokenBalanceWarning = useMemo(() => {
    const rawAvailableBalance = computeRawAvailableBalance(allowWrappingNativeAssets);
    if (rawAvailableBalance == undefined || rawSupplyAmount == 0n) {
      return false;
    }

    return (
      isWrappedNative &&
      allowWrappingNativeAssets &&
      rawSupplyAmount >= rawAvailableBalance - GAS_BUFFER_WARNING_TOLERANCE // Show warning when above or within tolerance of the threshold
    );
  }, [isWrappedNative, allowWrappingNativeAssets, rawSupplyAmount, computeRawAvailableBalance]);

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
                rawAvailableBalance={computeRawAvailableBalance(allowWrappingNativeAssets)}
                setIsMax={(isMax) => {
                  form.setValue("isMaxSupply", isMax);
                }}
              />
              {isWrappedNative && (
                <div className="flex rounded-[8px] bg-background-inverse p-3">
                  <SwitchFormField labelContent="Allow Wrapping:" switchLabel="POL" name="allowWrappingNativeAssets" />
                </div>
              )}
              {shouldShowLowNetworkTokenBalanceWarning && <LowNetworkTokenBalanceWarning />}

              <div className="flex min-w-0 flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={simulatingBundle || !form.formState.isValid}
                  isLoading={simulatingBundle}
                  loadingMessage="Simulating"
                >
                  {rawSupplyAmount == 0n ? "Enter Amount" : "Review Supply"}
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
              rawAmount={preparedAction.positionChange.delta.rawAmount}
            />
          </ActionFlowSummary>
          <ActionFlowReview>
            <MetricChange
              name={`Position (${vault.asset.symbol})`}
              initialValue={formatNumber(
                calculateUsdValue(
                  preparedAction.positionChange.before.rawAmount,
                  vault.asset.decimals,
                  vault.asset.priceUsd
                ),
                { currency: "USD" }
              )}
              finalValue={formatNumber(
                calculateUsdValue(
                  preparedAction.positionChange.after.rawAmount,
                  vault.asset.decimals,
                  vault.asset.priceUsd
                ),
                { currency: "USD" }
              )}
            />
            {shouldShowLowNetworkTokenBalanceWarning && <LowNetworkTokenBalanceWarning />}
          </ActionFlowReview>
          <ActionFlowButton>Supply</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
