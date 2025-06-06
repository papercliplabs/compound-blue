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
import { descaleBigIntToNumber, formatNumber, numberToString } from "@/utils/format";
import { isAssetVaultShare } from "@/utils/isAssetVaultShare";
import { computeNewBorrowMax } from "@/utils/market";

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

  const descaledCollateralTokenBalance = useMemo(
    () =>
      userCollateralTokenHolding
        ? descaleBigIntToNumber(userCollateralTokenHolding.balance, market.collateralAsset.decimals)
        : undefined,
    [userCollateralTokenHolding, market.collateralAsset.decimals]
  );

  const formSchema = useMemo(() => {
    return z
      .object({
        supplyCollateralAmount: z
          .string()
          .optional()
          .pipe(
            z.coerce
              .number()
              .nonnegative()
              .max(descaledCollateralTokenBalance ?? Number.MAX_VALUE, { message: "Amount exceeds wallet balance." })
              .optional()
          ),
        isMaxSupply: z.boolean(),
        borrowAmount: z.string().optional().pipe(z.coerce.number().nonnegative().optional()),
      })
      .refine(
        (data) => {
          if (!userPosition) {
            return true;
          }
          const newBorrowMax = computeNewBorrowMax(market, data.supplyCollateralAmount ?? 0, userPosition);
          return (data.borrowAmount ?? 0) <= newBorrowMax;
        },
        {
          message: "Amount exceeds borrow capacity.",
          path: ["borrowAmount"],
        }
      );
  }, [descaledCollateralTokenBalance, userPosition, market]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      isMaxSupply: false,
    },
  });

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
    setSuccess(true);
  }, [form, setSuccess]);

  const supplyCollateralAmount = Number(form.watch("supplyCollateralAmount") ?? 0);
  const borrowAmount = Number(form.watch("borrowAmount") ?? 0);

  // Anytime the supplyCollateralAmount changes, trigger the borrowAmount validation since it depends on it
  useEffect(() => {
    void form.trigger("borrowAmount");
  }, [supplyCollateralAmount, form]);

  const descaledBorrowMax = useMemo(() => {
    return computeNewBorrowMax(market, supplyCollateralAmount, userPosition);
  }, [userPosition, supplyCollateralAmount, market]);

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

      const { supplyCollateralAmount = 0, borrowAmount = 0, isMaxSupply } = values;

      setSimulatingBundle(true);

      // uint256 max for entire collateral balance
      const supplyCollateralAmountBigInt =
        supplyCollateralAmount > 0 && isMaxSupply
          ? maxUint256
          : parseUnits(numberToString(supplyCollateralAmount), market.collateralAsset.decimals);

      const borrowAmountBigInt = parseUnits(numberToString(borrowAmount), market.loanAsset.decimals);

      const preparedAction = await marketSupplyCollateralAndBorrowAction({
        publicClient,
        marketId: market.marketId as MarketId,
        accountAddress: address,
        allocatingVaultAddresses: market.vaultAllocations.map((allocation) =>
          getAddress(allocation.vault.vaultAddress)
        ),
        collateralAmount: supplyCollateralAmountBigInt,
        borrowAmount: borrowAmountBigInt,
      });

      setPreparedAction(preparedAction);

      if (preparedAction.status === "success") {
        setOpen(true);
      }

      setSimulatingBundle(false);
    },
    [publicClient, address, market, openConnectModal]
  );

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
                descaledAvailableBalance={descaledCollateralTokenBalance}
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
                  descaledAvailableBalance={descaledBorrowMax}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  variant="borrow"
                  disabled={
                    simulatingBundle || (borrowAmount == 0 && supplyCollateralAmount == 0) || !form.formState.isValid
                  }
                  isLoading={simulatingBundle}
                  loadingMessage="Simulating"
                >
                  {borrowAmount == 0 && supplyCollateralAmount == 0 ? "Enter Amount" : "Review"}
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
          trackingPayload={getTrackingPayload(market, preparedAction, "market-supply-collateral-and-borrow")}
        >
          <ActionFlowSummary>
            {supplyCollateralAmount > 0 && (
              <ActionFlowSummaryAssetItem
                asset={market.collateralAsset}
                actionName="Add"
                side="supply"
                isIncreasing={true}
                descaledAmount={supplyCollateralAmount}
                amountUsd={supplyCollateralAmount * (market.collateralAsset.priceUsd ?? 0)}
              />
            )}
            {borrowAmount > 0 && (
              <ActionFlowSummaryAssetItem
                asset={market.loanAsset}
                actionName="Borrow"
                side="borrow"
                isIncreasing={true}
                descaledAmount={borrowAmount}
                amountUsd={borrowAmount * (market.loanAsset.priceUsd ?? 0)}
              />
            )}
          </ActionFlowSummary>
          <ActionFlowReview className="flex flex-col gap-4">
            {supplyCollateralAmount > 0 && (
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
            {borrowAmount > 0 && (
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
            {supplyCollateralAmount > 0 && "Supply Collateral"}
            {supplyCollateralAmount > 0 && borrowAmount > 0 && " & "}
            {borrowAmount > 0 && "Borrow"}
          </ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}

function getTrackingPayload(market: MarketNonIdle, action: MarketSupplyCollateralAndBorrowAction | null, tag: string) {
  const basePayload = {
    tag,
    marketId: market.marketId,
  };

  if (!action || action.status !== "success") {
    return basePayload;
  }

  const collateralDelta =
    action.positionCollateralChange.after.rawAmount - action.positionCollateralChange.before.rawAmount;
  const loanDelta = action.positionLoanChange.after.rawAmount - action.positionLoanChange.before.rawAmount;
  return {
    ...basePayload,
    collateralAmount: Math.abs(descaleBigIntToNumber(collateralDelta, market.collateralAsset.decimals)),
    loanAmount: Math.abs(descaleBigIntToNumber(loanDelta, market.loanAsset.decimals)),
  };
}
