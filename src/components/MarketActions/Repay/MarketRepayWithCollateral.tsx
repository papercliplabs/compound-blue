"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MarketId } from "@morpho-org/blue-sdk";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowRight, Info } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { maxUint256, parseUnits } from "viem";
import { usePublicClient } from "wagmi";
import { useAccount } from "wagmi";
import { z } from "zod";

import {
  MarketRepayWithCollateralAction,
  marketRepayWithCollateralAction,
} from "@/actions/market/marketRepayWithCollateralAction";
import AssetFormField from "@/components/FormFields/AssetFormField";
import { MetricChange } from "@/components/MetricChange";
import { MarketNonIdle } from "@/data/whisk/getMarket";
import { useAccountMarketPosition } from "@/hooks/useAccountMarketPosition";
import { descaleBigIntToNumber, formatNumber, numberToString } from "@/utils/format";

import { ActionFlowDialog, ActionFlowReview, ActionFlowSummary } from "../../ActionFlowDialog";
import { ActionFlowButton, ActionFlowSummaryAssetItem } from "../../ActionFlowDialog";
import { Button } from "../../ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../ui/form";
import PoweredByMorpho from "../../ui/icons/PoweredByMorpho";
import { Input } from "../../ui/input";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../../ui/tooltipPopover";

const MAX_SLIPPAGE_TOLERANCE_PCT = 15;

export default function MarketRepayWithCollateral({
  market,
  onCloseAfterSuccess,
}: {
  market: MarketNonIdle;
  onCloseAfterSuccess?: () => void;
}) {
  const [preparedAction, setPreparedAction] = useState<MarketRepayWithCollateralAction | undefined>(undefined);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [open, setOpen] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [success, setSuccess] = useState(false);
  const { data: userPosition } = useAccountMarketPosition(market.marketId as MarketId);

  const positionLoanAmount = useMemo(() => {
    return userPosition ? descaleBigIntToNumber(userPosition.borrowAssets, market.loanAsset.decimals) : undefined;
  }, [userPosition, market.loanAsset.decimals]);

  const formSchema = useMemo(() => {
    return z.object({
      repayAmount: z.coerce
        .string()
        .refine((val) => Number(val) <= (positionLoanAmount ?? Number.MAX_VALUE), "Amount exceeds position balance.")
        .transform((val) => Number(val)),
      isMaxRepay: z.boolean(),
      maxSlippageTolerance: z.coerce.number().min(0.2).max(MAX_SLIPPAGE_TOLERANCE_PCT),
    });
  }, [positionLoanAmount]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      repayAmount: undefined,
      isMaxRepay: false,
      maxSlippageTolerance: 0.5,
    },
  });

  const repayAmount = form.watch("repayAmount") ?? 0;

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
    setSuccess(true);
  }, [form, setSuccess]);

  const onSubmit = useCallback(
    async ({ repayAmount, isMaxRepay, maxSlippageTolerance }: z.infer<typeof formSchema>) => {
      if (!address) {
        openConnectModal?.();
        return;
      }

      if (!publicClient) {
        // Should never get here...
        throw new Error("Missing pulic client");
      }

      setSimulatingBundle(true);

      const rawRepayAmount = isMaxRepay
        ? maxUint256
        : parseUnits(numberToString(repayAmount), market.loanAsset.decimals);

      const action = await marketRepayWithCollateralAction({
        publicClient,
        accountAddress: address,
        marketId: market.marketId as MarketId,
        loanRepayAmount: rawRepayAmount,
        maxSlippageTolerance: maxSlippageTolerance / 100, // in % from user
      });

      setPreparedAction(action);

      if (action.status === "success") {
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
              <div className="[&_label]:text-accent-ternary">
                <AssetFormField
                  control={form.control}
                  name="repayAmount"
                  actionName="Repay"
                  asset={market.loanAsset}
                  descaledAvailableBalance={positionLoanAmount}
                  setIsMax={(isMax) => {
                    form.setValue("isMaxRepay", isMax);
                  }}
                />
              </div>
              <div className="h-[1px] w-full bg-border-primary" />

              <FormField
                name="maxSlippageTolerance"
                control={form.control}
                render={({ field: { value, onChange } }) => (
                  <FormItem className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-content-secondary">
                        <TooltipPopover>
                          <TooltipPopoverTrigger className="flex items-center gap-1">
                            Max Slippage
                            <Info size={16} />
                          </TooltipPopoverTrigger>
                          <TooltipPopoverContent className="flex flex-col gap-2">
                            <p>
                              The maximum price difference you&apos;re willing to accept when swapping tokens, measured
                              against the market oracle price (not exchange spot price).
                            </p>
                            <p>
                              Higher slippages increase trade success rates but may result in worse prices, while lower
                              slippages ensure better prices but may cause transactions to fail.
                            </p>
                          </TooltipPopoverContent>
                        </TooltipPopover>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="0"
                            inputMode="decimal"
                            type="text"
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^0*(\d+)?(\.\d*)?$/.test(value)) {
                                onChange(value);
                              }
                            }}
                            value={value ?? ""}
                            className="w-[56px] border p-2 pr-[22px] label-sm"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-content-secondary label-sm">
                            %
                          </div>
                        </div>
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex min-w-0 flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  variant="borrow"
                  disabled={simulatingBundle || repayAmount == 0 || !form.formState.isValid}
                  isLoading={simulatingBundle}
                  loadingMessage="Simulating"
                >
                  {repayAmount == 0 ? "Enter Amount" : "Review"}
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
          trackingPayload={getTrackingPayload(market, preparedAction, "market-repay-with-collateral")}
        >
          <ActionFlowSummary>
            <ActionFlowSummaryAssetItem
              asset={market.loanAsset}
              actionName="Repay"
              side="borrow"
              isIncreasing={false}
              descaledAmount={descaleBigIntToNumber(
                preparedAction.positionLoanChange.before - preparedAction.positionLoanChange.after,
                market.loanAsset.decimals
              )}
              amountUsd={
                descaleBigIntToNumber(
                  preparedAction.positionLoanChange.before - preparedAction.positionLoanChange.after,
                  market.loanAsset.decimals
                ) * (market.loanAsset.priceUsd ?? 0)
              }
            />
            <ActionFlowSummaryAssetItem
              asset={market.collateralAsset}
              actionName="Withdraw"
              side="supply"
              isIncreasing={false}
              descaledAmount={descaleBigIntToNumber(
                preparedAction.positionCollateralChange.before - preparedAction.positionCollateralChange.after,
                market.collateralAsset.decimals
              )}
              amountUsd={
                descaleBigIntToNumber(
                  preparedAction.positionCollateralChange.before - preparedAction.positionCollateralChange.after,
                  market.collateralAsset.decimals
                ) * (market.collateralAsset.priceUsd ?? 0)
              }
            />
          </ActionFlowSummary>
          <ActionFlowReview className="flex flex-col gap-4">
            <MetricChange
              name={`Collateral (${market.collateralAsset.symbol})`}
              initialValue={formatNumber(
                descaleBigIntToNumber(preparedAction.positionCollateralChange.before, market.collateralAsset.decimals) *
                  (market.collateralAsset.priceUsd ?? 0),
                {
                  currency: "USD",
                }
              )}
              finalValue={formatNumber(
                descaleBigIntToNumber(preparedAction.positionCollateralChange.after, market.collateralAsset.decimals) *
                  (market.collateralAsset.priceUsd ?? 0),
                {
                  currency: "USD",
                }
              )}
            />
            <MetricChange
              name={`Loan (${market.loanAsset.symbol})`}
              initialValue={formatNumber(
                descaleBigIntToNumber(preparedAction.positionLoanChange.before, market.loanAsset.decimals) *
                  (market.loanAsset.priceUsd ?? 0),
                {
                  currency: "USD",
                }
              )}
              finalValue={formatNumber(
                descaleBigIntToNumber(preparedAction.positionLoanChange.after, market.loanAsset.decimals) *
                  (market.loanAsset.priceUsd ?? 0),
                {
                  currency: "USD",
                }
              )}
            />
            <div className="flex items-center justify-between">
              <span>LTV / LLTV</span>
              <div className="flex items-center gap-1 label-md">
                <span className="text-content-secondary">
                  (
                  {formatNumber(descaleBigIntToNumber(preparedAction.positionLtvChange.before, 18), {
                    style: "percent",
                  })}
                </span>
                <ArrowRight size={14} className="stroke-content-secondary" />
                {formatNumber(descaleBigIntToNumber(preparedAction.positionLtvChange.after, 18), {
                  style: "percent",
                })}
                ) / {formatNumber(market.lltv, { style: "percent" })}
              </div>
            </div>
          </ActionFlowReview>
          <ActionFlowButton variant="borrow">Repay with Collateral</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}

function getTrackingPayload(market: MarketNonIdle, action: MarketRepayWithCollateralAction | null, tag: string) {
  const basePayload = {
    tag,
    marketId: market.marketId,
  };

  if (!action || action.status !== "success") {
    return basePayload;
  }

  const collateralDelta = descaleBigIntToNumber(
    action.positionCollateralChange.after - action.positionCollateralChange.before,
    market.collateralAsset.decimals
  );
  const loanDelta = descaleBigIntToNumber(
    action.positionLoanChange.after - action.positionLoanChange.before,
    market.loanAsset.decimals
  );
  const collateralDeltaUsd = market.collateralAsset.priceUsd
    ? collateralDelta * market.collateralAsset.priceUsd
    : undefined;
  const loanDeltaUsd = market.loanAsset.priceUsd ? loanDelta * market.loanAsset.priceUsd : undefined;

  return {
    ...basePayload,
    collateralAmount: Math.abs(collateralDelta),
    loanAmount: Math.abs(loanDelta),
    collateralAmountUsd: collateralDeltaUsd !== undefined ? Math.abs(collateralDeltaUsd) : "",
    loanAmountUsd: loanDeltaUsd !== undefined ? Math.abs(loanDeltaUsd) : "",
  };
}
