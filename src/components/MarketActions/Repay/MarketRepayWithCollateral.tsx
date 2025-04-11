"use client";
import { ActionFlowButton, ActionFlowSummaryAssetItem } from "../../ActionFlowDialog";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../../ui/button";
import { ActionFlowDialog, ActionFlowReview, ActionFlowSummary } from "../../ActionFlowDialog";
import { usePublicClient } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { MarketId } from "@morpho-org/blue-sdk";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AssetFormField from "../../AssetFormField";
import PoweredByMorpho from "../../ui/icons/PoweredByMorpho";
import { maxUint256, parseUnits } from "viem";
import { descaleBigIntToNumber, formatNumber, numberToString } from "@/utils/format";
import { Input } from "../../ui/input";
import { ArrowRight, Info } from "lucide-react";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../../ui/tooltipPopover";
import { useAccountMarketPosition } from "@/hooks/useAccountMarketPosition";
import {
  prepareMarketRepayWithCollateralAction,
  PrepareMarketRepayWithCollateralActionReturnType,
} from "@/actions/prepareMarketRepayWithCollateralAction";
import { MetricChange } from "@/components/MetricChange";
import { MarketNonIdle } from "@/data/whisk/getMarket";

const MAX_SLIPPAGE_TOLERANCE_PCT = 15;

export default function MarketRepayWithCollateral({
  market,
  onCloseAfterSuccess,
}: {
  market: MarketNonIdle;
  onCloseAfterSuccess?: () => void;
}) {
  const [preparedAction, setPreparedAction] = useState<PrepareMarketRepayWithCollateralActionReturnType | undefined>(
    undefined
  );
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
      maxSlippageTolerance: 0.3,
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

      const action = await prepareMarketRepayWithCollateralAction({
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
                      <FormLabel>
                        <TooltipPopover>
                          <TooltipPopoverTrigger className="flex items-center gap-1 text-content-secondary">
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
                  className="w-full bg-accent-ternary"
                  disabled={simulatingBundle || repayAmount == 0 || !form.formState.isValid}
                >
                  {repayAmount == 0 ? "Enter Amount" : simulatingBundle ? "Simulating..." : "Review"}
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
          <ActionFlowButton className="bg-accent-ternary">Repay with Collateral</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
