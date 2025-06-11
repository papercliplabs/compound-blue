"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { MarketId } from "@morpho-org/blue-sdk";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { getAddress, maxUint256, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { z } from "zod";

import {
  MarketSupplyCollateralAndBorrowAction,
  marketSupplyCollateralAndBorrowAction,
} from "@/actions/market/marketSupplyCollateralAndBorrowAction";
import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowReview,
  ActionFlowSummary,
  ActionFlowSummaryAssetItem,
} from "@/components/ActionFlowDialog";
import AssetFormField from "@/components/FormFields/AssetFormField";
import { Form } from "@/components/ui/form";
import { MarketNonIdle } from "@/data/whisk/getMarket";
import { useAccountMarketPosition } from "@/hooks/useAccountMarketPosition";
import { useAccountTokenHolding } from "@/hooks/useAccountTokenHolding";
import { useWatchParseUnits } from "@/hooks/useWatch";
import { formatNumber } from "@/utils/format";
import { isAssetVaultShare } from "@/utils/isAssetVaultShare";
import { computeMaxBorrowableAssets } from "@/utils/market";

import { MetricChange } from "../../MetricChange";
import { Button } from "../../ui/button";
import PoweredByMorpho from "../../ui/icons/PoweredByMorpho";

export default function MarketSupplyCollateralBorrow({
  market,
  onCloseAfterSuccess,
}: {
  market: MarketNonIdle;
  onCloseAfterSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<MarketSupplyCollateralAndBorrowAction | undefined>(undefined);
  const [success, setSuccess] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: userCollateralTokenHolding } = useAccountTokenHolding(getAddress(market.collateralAsset.address));
  const { data: userPosition } = useAccountMarketPosition(market.marketId as MarketId);

  const collateralIsVault = useMemo(() => {
    return isAssetVaultShare(getAddress(market.collateralAsset.address));
  }, [market.collateralAsset.address]);

  const formSchema = useMemo(() => {
    return z
      .object({
        supplyCollateralAmount: z
          .string({ required_error: "Amount is required." }) // Means it can't be undefined, but empty string is valid
          .refine((val) => !isNaN(parseFloat(val)), "Amount must be a valid number.")
          .refine((val) => parseUnits(val, market.collateralAsset.decimals) > 0n, "Amount must be greater than zero.") // This also catches the case where val is lower than token precision, but we prevent this in ActionFlowSummaryAssetItem
          .refine((val) => {
            if (!userCollateralTokenHolding) {
              return true;
            }

            const rawVal = parseUnits(val, market.collateralAsset.decimals);
            return rawVal <= BigInt(userCollateralTokenHolding.balance);
          }, "Amount exceeds wallet balance.")
          .or(z.literal("")),
        isMaxSupply: z.boolean(),
        borrowAmount: z
          .string({ required_error: "Amount is required." }) // Means it can't be undefined, but empty string is valid
          .refine((val) => !isNaN(parseFloat(val)), "Amount must be a valid number.")
          .refine((val) => parseUnits(val, market.loanAsset.decimals) > 0n, "Amount must be greater than zero.") // This also catches the case where val is lower than token precision, but we prevent this in ActionFlowSummaryAssetItem
          .or(z.literal("")),
      })
      .refine(
        (data) => {
          if (!userPosition) {
            return true;
          }

          const rawSupplyCollateralAmount =
            data.supplyCollateralAmount == ""
              ? 0n
              : parseUnits(data.supplyCollateralAmount, market.collateralAsset.decimals);
          const rawBorrowAmount =
            data.borrowAmount == "" ? 0n : parseUnits(data.borrowAmount, market.loanAsset.decimals);
          const rawMaxBorrowable = computeMaxBorrowableAssets(market, rawSupplyCollateralAmount, userPosition);

          return rawBorrowAmount <= rawMaxBorrowable;
        },
        {
          message: "Amount exceeds borrow capacity.",
          path: ["borrowAmount"],
        }
      );
  }, [market, userCollateralTokenHolding, userPosition]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplyCollateralAmount: "",
      borrowAmount: "",
      isMaxSupply: false,
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

      const { supplyCollateralAmount, borrowAmount, isMaxSupply } = values;

      setSimulatingBundle(true);

      let rawSupplyCollateralAmount =
        supplyCollateralAmount == "" ? 0n : parseUnits(supplyCollateralAmount, market.collateralAsset.decimals);
      const rawBorrowAmount = borrowAmount == "" ? 0n : parseUnits(borrowAmount, market.loanAsset.decimals);

      if (rawSupplyCollateralAmount > 0n && isMaxSupply) {
        // uint256 max for entire collateral balance
        rawSupplyCollateralAmount = maxUint256;
      }

      const preparedAction = await marketSupplyCollateralAndBorrowAction({
        publicClient,
        marketId: market.marketId as MarketId,
        accountAddress: address,
        allocatingVaultAddresses: market.vaultAllocations.map((allocation) =>
          getAddress(allocation.vault.vaultAddress)
        ),
        collateralAmount: rawSupplyCollateralAmount,
        borrowAmount: rawBorrowAmount,
      });

      setPreparedAction(preparedAction);

      if (preparedAction.status === "success") {
        setOpen(true);
      }

      setSimulatingBundle(false);
    },
    [publicClient, address, market, openConnectModal]
  );

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
    setSuccess(true);
  }, [form, setSuccess]);

  const rawSupplyCollateralAmount = useWatchParseUnits({
    control: form.control,
    name: "supplyCollateralAmount",
    decimals: market.collateralAsset.decimals,
  });
  const rawBorrowAmount = useWatchParseUnits({
    control: form.control,
    name: "borrowAmount",
    decimals: market.loanAsset.decimals,
  });

  // Anytime the supplyCollateralAmount changes, trigger the borrowAmount validation since it depends on it
  useEffect(() => {
    void form.trigger("borrowAmount");
  }, [rawSupplyCollateralAmount, form]);

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={simulatingBundle || open} style={{ all: "unset", width: "100%" }}>
            <div className="flex w-full flex-col gap-7 overflow-hidden">
              <AssetFormField
                control={form.control}
                name="supplyCollateralAmount"
                actionName="Add"
                asset={market.collateralAsset}
                rawAvailableBalance={
                  userCollateralTokenHolding ? BigInt(userCollateralTokenHolding.balance) : undefined
                }
                setIsMax={(isMax) => {
                  form.setValue("isMaxSupply", isMax);
                }}
              />
              {collateralIsVault && (
                <Link
                  href={`/${market.collateralAsset.address}`}
                  className="flex items-center justify-between gap-2 rounded-[8px] border px-4 py-3 text-content-secondary transition-all hover:bg-button-neutral/50"
                >
                  Deposit liqudity in the {market.collateralAsset.symbol} vault to use it as collateral here.
                  <ArrowUpRight size={16} className="shrink-0" />
                </Link>
              )}
              <div className="h-[1px] w-full bg-border-primary" />
              <div className="[&_label]:text-accent-ternary">
                <AssetFormField
                  control={form.control}
                  name="borrowAmount"
                  actionName="Borrow"
                  asset={market.loanAsset}
                  rawAvailableBalance={computeMaxBorrowableAssets(market, rawSupplyCollateralAmount, userPosition)}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  variant="borrow"
                  disabled={
                    simulatingBundle ||
                    (rawBorrowAmount == 0n && rawSupplyCollateralAmount == 0n) ||
                    !form.formState.isValid
                  }
                  isLoading={simulatingBundle}
                  loadingMessage="Simulating"
                >
                  {rawBorrowAmount == 0n && rawSupplyCollateralAmount == 0n ? "Enter Amount" : "Review"}
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
            {rawSupplyCollateralAmount > 0n && (
              <ActionFlowSummaryAssetItem
                asset={market.collateralAsset}
                actionName="Add"
                side="supply"
                isIncreasing={true}
                rawAmount={rawSupplyCollateralAmount}
              />
            )}
            {rawBorrowAmount > 0n && (
              <ActionFlowSummaryAssetItem
                asset={market.loanAsset}
                actionName="Borrow"
                side="borrow"
                isIncreasing={true}
                rawAmount={rawBorrowAmount}
              />
            )}
          </ActionFlowSummary>
          <ActionFlowReview className="flex flex-col gap-4">
            {rawSupplyCollateralAmount > 0n && (
              <MetricChange
                name={`Collateral (${market.collateralAsset.symbol})`}
                initialValue={formatNumber(
                  preparedAction.positionCollateralChange.before.amount * (market.collateralAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
                finalValue={formatNumber(
                  preparedAction.positionCollateralChange.after.amount * (market.collateralAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
              />
            )}
            {rawBorrowAmount > 0n && (
              <MetricChange
                name={`Loan (${market.loanAsset.symbol})`}
                initialValue={formatNumber(
                  preparedAction.positionLoanChange.before.amount * (market.loanAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
                finalValue={formatNumber(
                  preparedAction.positionLoanChange.after.amount * (market.loanAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
              />
            )}
            <div className="flex items-center justify-between">
              <span>LTV / LLTV</span>
              <div className="flex items-center gap-1 label-md">
                <span className="text-content-secondary">
                  (
                  {formatNumber(preparedAction.positionLtvChange.before, {
                    style: "percent",
                  })}
                </span>
                <ArrowRight size={14} className="stroke-content-secondary" />
                {formatNumber(preparedAction.positionLtvChange.after, {
                  style: "percent",
                })}
                ) / {formatNumber(market.lltv, { style: "percent" })}
              </div>
            </div>
          </ActionFlowReview>
          <ActionFlowButton variant="borrow">
            {rawSupplyCollateralAmount > 0n && "Supply Collateral"}
            {rawSupplyCollateralAmount > 0n && rawBorrowAmount > 0n && " & "}
            {rawBorrowAmount > 0n && "Borrow"}
          </ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
