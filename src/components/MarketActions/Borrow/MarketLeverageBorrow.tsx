"use client";
import { ActionFlowButton, ActionFlowSummaryAssetItem } from "../../ActionFlowDialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../ui/button";
import { ActionFlowDialog, ActionFlowReview, ActionFlowSummary } from "../../ActionFlowDialog";
import { usePublicClient } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import {
  prepareMarketLeveragedBorrowAction,
  PrepareMarketLeveragedBorrowActionReturnType,
} from "@/actions/prepareMarketLeverageBorrowAction";
import { MarketId } from "@morpho-org/blue-sdk";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import PoweredByMorpho from "../../ui/icons/PoweredByMorpho";
import { useAccountTokenHolding } from "@/hooks/useAccountTokenHolding";
import { getAddress, maxUint256, parseUnits } from "viem";
import { descaleBigIntToNumber, formatNumber, numberToString } from "@/utils/format";
import SliderFormField from "../../FormFields/SliderFormField";
import { Input } from "../../ui/input";
import { ArrowRight, Info } from "lucide-react";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../../ui/tooltipPopover";
import { computeMaxLeverageFactor } from "@/actions/prepareMarketLeverageBorrowAction/computeLeverageValues";
import { MetricChange } from "../../MetricChange";
import NumberFlow from "../../ui/NumberFlow";
import { MarketNonIdle } from "@/data/whisk/getMarket";
import AssetFormField from "@/components/FormFields/AssetFormField";

const MAX_SLIPPAGE_TOLERANCE_PCT = 15;
const MIN_MULTIPLIER = 1.1;

// Use multiplier instead of leverageFactor since its more intuitive for users.
// maxSlippageTolerance in (0,1)
function computeMaxMultiplier(lltv: number, maxSlippageTolerance: number) {
  const maxLeverageFactor = computeMaxLeverageFactor(lltv, maxSlippageTolerance);
  const maxMultiplier = (maxLeverageFactor - 1) * (1 + maxSlippageTolerance);
  return Math.trunc(maxMultiplier * 100) / 100;
}

export default function MarketLeverageBorrow({
  market,
  onCloseAfterSuccess,
}: {
  market: MarketNonIdle;
  onCloseAfterSuccess?: () => void;
}) {
  const [preparedAction, setPreparedAction] = useState<PrepareMarketLeveragedBorrowActionReturnType | undefined>(
    undefined
  );
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [open, setOpen] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [success, setSuccess] = useState(false);

  const { data: rawCollateralTokenBalance } = useAccountTokenHolding(getAddress(market.collateralAsset.address));

  const collateralTokenBalance = useMemo(() => {
    return rawCollateralTokenBalance
      ? descaleBigIntToNumber(rawCollateralTokenBalance.balance, market.collateralAsset.decimals)
      : undefined;
  }, [rawCollateralTokenBalance, market.collateralAsset.decimals]);

  const formSchema = useMemo(() => {
    return z
      .object({
        initialCollateralAmount: z.coerce
          .string()
          .refine(
            (val) => Number(val) <= (collateralTokenBalance ?? Number.MAX_VALUE),
            "Amount exceeds wallet balance."
          )
          .transform((val) => Number(val)),
        isMaxCollateral: z.boolean(),
        multiplier: z.coerce.number().min(MIN_MULTIPLIER),
        maxSlippageTolerance: z.coerce.number().min(0.2).max(MAX_SLIPPAGE_TOLERANCE_PCT),
      })
      .refine(
        (data) => {
          const maxMultipler = computeMaxMultiplier(
            market.lltv,
            Math.min(data.maxSlippageTolerance, MAX_SLIPPAGE_TOLERANCE_PCT) / 100
          );
          return data.multiplier <= maxMultipler;
        },
        {
          message: `Multiplier too large.`,
          path: ["multiplier"],
        }
      );
  }, [collateralTokenBalance, market.lltv]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      initialCollateralAmount: undefined,
      isMaxCollateral: false,
      multiplier: 2,
      maxSlippageTolerance: 0.5,
    },
  });

  const initialCollateralAmount = form.watch("initialCollateralAmount") ?? 0;
  const maxSlippageTolerance = form.watch("maxSlippageTolerance") ?? 0.3;
  const multiplier = form.watch("multiplier") ?? MIN_MULTIPLIER;
  const maxMultiplier = useMemo(
    () => computeMaxMultiplier(market.lltv, Math.min(maxSlippageTolerance, MAX_SLIPPAGE_TOLERANCE_PCT) / 100),
    [market.lltv, maxSlippageTolerance]
  );

  const effectiveApyEstimate = useMemo(() => market.borrowApy.total * multiplier, [market.borrowApy.total, multiplier]);

  // Anytime the maxSlippageTolerance changes, trigger the multiplier validation since it depends on it
  useEffect(() => {
    void form.trigger("multiplier");
  }, [maxSlippageTolerance, form]);

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
    setSuccess(true);
  }, [form, setSuccess]);

  const onSubmit = useCallback(
    async ({
      initialCollateralAmount,
      isMaxCollateral,
      multiplier,
      maxSlippageTolerance,
    }: z.infer<typeof formSchema>) => {
      if (!address) {
        openConnectModal?.();
        return;
      }

      if (!publicClient) {
        // Should never get here...
        throw new Error("Missing pulic client");
      }

      setSimulatingBundle(true);

      const rawInitialCollateralAmount = isMaxCollateral
        ? maxUint256
        : parseUnits(numberToString(initialCollateralAmount), market.collateralAsset.decimals);

      const leverageFactor = multiplier / (1 + maxSlippageTolerance / 100) + 1;

      const action = await prepareMarketLeveragedBorrowAction({
        publicClient,
        accountAddress: address,
        marketId: market.marketId as MarketId,
        initialCollateralAmount: rawInitialCollateralAmount,
        leverageFactor,
        maxSlippageTolerance: maxSlippageTolerance / 100, // in % from user
        allocatingVaultAddresses: market.vaultAllocations.map((allocation) =>
          getAddress(allocation.vault.vaultAddress)
        ),
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
              <AssetFormField
                control={form.control}
                name="initialCollateralAmount"
                actionName="Add"
                asset={market.collateralAsset}
                descaledAvailableBalance={collateralTokenBalance}
                setIsMax={(isMax) => {
                  form.setValue("isMaxCollateral", isMax);
                }}
              />
              <div className="h-[1px] w-full bg-border-primary" />

              <SliderFormField
                control={form.control}
                name="multiplier"
                labelContent={
                  <TooltipPopover>
                    <TooltipPopoverTrigger className="flex items-center gap-1">
                      Multiplier
                      <Info size={16} />
                    </TooltipPopoverTrigger>
                    <TooltipPopoverContent className="flex flex-col gap-2">
                      <p>
                        This strategy multiplies your position size, increasing your market exposure and borrow APY.
                        This is effectively looping: supplying collateral, borrowing against it, swapping for more
                        collateral, and repeating.
                      </p>
                      <p>Higher multipliers increase your position&apos;s LTV, bringing it closer to liquidation.</p>
                    </TooltipPopoverContent>
                  </TooltipPopover>
                }
                sliderMin={MIN_MULTIPLIER}
                sliderMax={maxMultiplier}
                sliderStep={0.1}
                unit="x"
              />
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

              <div className="h-[1px] w-full bg-border-primary" />

              <MetricChange
                name={"Effective APY"}
                initialValue={<NumberFlow value={effectiveApyEstimate} format={{ style: "percent" }} />}
              />

              <div className="flex min-w-0 flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full bg-accent-ternary"
                  disabled={simulatingBundle || initialCollateralAmount == 0 || !form.formState.isValid}
                  isLoading={simulatingBundle}
                  loadingMessage="Simulating"
                >
                  {initialCollateralAmount == 0 ? "Enter Amount" : "Review"}
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
              asset={market.collateralAsset}
              actionName="Add"
              side="supply"
              isIncreasing={true}
              descaledAmount={descaleBigIntToNumber(
                preparedAction.positionCollateralChange.after - preparedAction.positionCollateralChange.before,
                market.collateralAsset.decimals
              )}
              amountUsd={
                descaleBigIntToNumber(
                  preparedAction.positionCollateralChange.after - preparedAction.positionCollateralChange.before,
                  market.collateralAsset.decimals
                ) * (market.collateralAsset.priceUsd ?? 0)
              }
            />
            <ActionFlowSummaryAssetItem
              asset={market.loanAsset}
              actionName="Borrow"
              side="borrow"
              isIncreasing={true}
              descaledAmount={descaleBigIntToNumber(
                preparedAction.positionLoanChange.after - preparedAction.positionLoanChange.before,
                market.loanAsset.decimals
              )}
              amountUsd={
                descaleBigIntToNumber(
                  preparedAction.positionLoanChange.after - preparedAction.positionLoanChange.before,
                  market.loanAsset.decimals
                ) * (market.loanAsset.priceUsd ?? 0)
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
          <ActionFlowButton className="bg-accent-ternary">Multiply</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
