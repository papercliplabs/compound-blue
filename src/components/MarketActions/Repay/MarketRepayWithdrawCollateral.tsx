"use client";
import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowReview,
  ActionFlowSummary,
  ActionFlowSummaryAssetItem,
} from "@/components/ActionFlowDialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../ui/button";
import { useAccount, usePublicClient } from "wagmi";
import { getAddress, maxUint256, parseUnits } from "viem";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { descaleBigIntToNumber, formatNumber, numberToString } from "@/utils/format";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import AssetFormField from "../../AssetFormField";
import { MarketId } from "@morpho-org/blue-sdk";
import {
  prepareMarketRepayAndWithdrawCollateralAction,
  PrepareMarketRepayAndWithdrawCollateralActionReturnType,
} from "@/actions/prepareMarketRepayAndWithdrawCollateralAction";
import { MAX_BORROW_LTV_MARGIN } from "@/config";
import PoweredByMorpho from "../../ui/icons/PoweredByMorpho";
import { useAccountTokenHolding } from "@/hooks/useAccountTokenHolding";
import { useAccountMarketPosition } from "@/hooks/useAccountMarketPosition";
import { AccountMarketPositions } from "@/data/whisk/getAccountMarketPositions";
import { ArrowRight } from "lucide-react";
import { MetricChange } from "../../MetricChange";
import { MarketNonIdle } from "@/data/whisk/getMarket";

export default function MarketRepayWithdrawCollateral({
  market,
  onCloseAfterSuccess,
}: {
  market: MarketNonIdle;
  onCloseAfterSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<
    PrepareMarketRepayAndWithdrawCollateralActionReturnType | undefined
  >(undefined);
  const [success, setSuccess] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: userLoanTokenHolding } = useAccountTokenHolding(getAddress(market.loanAsset.address));
  const { data: userPosition } = useAccountMarketPosition(market.marketId as MarketId);

  const { descaledLoanAmount, descaledLoanAssetBalance, availableRepayAmount } = useMemo(() => {
    const descaledLoanAmount = userPosition
      ? descaleBigIntToNumber(userPosition.borrowAssets, market.loanAsset.decimals)
      : undefined;
    const descaledLoanAssetBalance = userLoanTokenHolding
      ? descaleBigIntToNumber(userLoanTokenHolding.balance, market.loanAsset.decimals)
      : undefined;
    return {
      descaledLoanAmount,
      descaledLoanAssetBalance,
      availableRepayAmount: Math.min(
        descaledLoanAmount ?? Number.MAX_VALUE,
        descaledLoanAssetBalance ?? Number.MAX_VALUE
      ),
    };
  }, [userPosition, userLoanTokenHolding, market.loanAsset.decimals]);

  const formSchema = useMemo(() => {
    return z
      .object({
        repayAmount: z
          .string()
          .optional()
          .pipe(
            z.coerce
              .number()
              .nonnegative()
              .max(descaledLoanAmount ?? Number.MAX_VALUE, { message: "Amount exceeds loan amount." })
              .max(descaledLoanAssetBalance ?? Number.MAX_VALUE, { message: "Amount exceeds wallet balance." })
              .optional()
          ),
        isMaxRepay: z.boolean(),
        withdrawCollateralAmount: z.string().optional().pipe(z.coerce.number().nonnegative().optional()),
      })
      .refine(
        (data) => {
          if (!userPosition) {
            return true;
          }
          const collateralWithdrawMax = computeCollateralWithdrawMax(data.repayAmount ?? 0, userPosition);
          return (data.withdrawCollateralAmount ?? 0) <= collateralWithdrawMax;
        },
        {
          message: "Causes unhealthy position.",
          path: ["withdrawCollateralAmount"],
        }
      );
  }, [descaledLoanAmount, descaledLoanAssetBalance, userPosition]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onTouched",
    resolver: zodResolver(formSchema),
    defaultValues: {
      isMaxRepay: false,
    },
  });

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
    setSuccess(true);
  }, [form, setSuccess]);

  const repayAmount = form.watch("repayAmount") ?? 0;
  const withdrawCollateralAmount = form.watch("withdrawCollateralAmount") ?? 0;

  const { descaledCollateralWithdrawMax, descaledPositionCollateralAmount } = useMemo(() => {
    return {
      descaledCollateralWithdrawMax: computeCollateralWithdrawMax(repayAmount, userPosition),
      descaledPositionCollateralAmount: descaleBigIntToNumber(
        userPosition?.collateralAssets ?? BigInt(0),
        market.collateralAsset.decimals
      ),
    };
  }, [userPosition, repayAmount, market]);

  // Anytime the repayAmount changes, trigger the withdrawCollateralAmount validation since it depends on it
  useEffect(() => {
    form.trigger("withdrawCollateralAmount");
  }, [repayAmount, form]);

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

      const { repayAmount = 0, withdrawCollateralAmount = 0 } = values;
      setSimulatingBundle(true);

      // Max is closing full position
      // Not using isMaxRepay for now, since it causes issues when limited by wallet balance
      const rawRepayAmount =
        repayAmount > 0 && repayAmount == descaledLoanAmount
          ? maxUint256
          : parseUnits(numberToString(repayAmount), market.loanAsset.decimals);

      const withdrawCollateralAmountBigInt =
        withdrawCollateralAmount > 0 && withdrawCollateralAmount == descaledPositionCollateralAmount // Collateral doesn't earn interest, so this is safe to do
          ? maxUint256
          : parseUnits(numberToString(withdrawCollateralAmount), market.collateralAsset.decimals);

      const preparedAction = await prepareMarketRepayAndWithdrawCollateralAction({
        publicClient,
        accountAddress: address,
        marketId: market.marketId as MarketId,
        repayAmount: rawRepayAmount,
        withdrawCollateralAmount: withdrawCollateralAmountBigInt,
      });

      setPreparedAction(preparedAction);

      if (preparedAction.status === "success") {
        setOpen(true);
      }

      setSimulatingBundle(false);
    },
    [publicClient, address, market, openConnectModal, descaledPositionCollateralAmount, descaledLoanAmount]
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
                  descaledAvailableBalance={availableRepayAmount}
                  setIsMax={(isMax) => {
                    form.setValue("isMaxRepay", isMax);
                  }}
                />
              </div>
              <div className="h-[1px] w-full bg-border-primary" />
              <AssetFormField
                control={form.control}
                name="withdrawCollateralAmount"
                actionName="Withdraw"
                asset={market.collateralAsset}
                descaledAvailableBalance={descaledCollateralWithdrawMax}
              />

              <div className="flex min-w-0 flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full bg-accent-ternary"
                  disabled={simulatingBundle || (repayAmount == 0 && withdrawCollateralAmount == 0)}
                >
                  {repayAmount == 0 && withdrawCollateralAmount == 0
                    ? "Enter Amount"
                    : simulatingBundle
                      ? "Simulating..."
                      : "Review"}
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
            {repayAmount > 0 && (
              <ActionFlowSummaryAssetItem
                asset={market.loanAsset}
                actionName="Repay"
                side="borrow"
                isIncreasing={false}
                descaledAmount={repayAmount}
                amountUsd={repayAmount * (market.loanAsset.priceUsd ?? 0)}
              />
            )}
            {withdrawCollateralAmount > 0 && (
              <ActionFlowSummaryAssetItem
                asset={market.collateralAsset}
                actionName="Withdraw"
                side="supply"
                isIncreasing={false}
                descaledAmount={withdrawCollateralAmount}
                amountUsd={withdrawCollateralAmount * (market.collateralAsset.priceUsd ?? 0)}
              />
            )}
          </ActionFlowSummary>
          <ActionFlowReview className="flex flex-col gap-4">
            {withdrawCollateralAmount > 0 && (
              <MetricChange
                name={`Collateral (${market.collateralAsset.symbol})`}
                initialValue={formatNumber(
                  descaleBigIntToNumber(
                    preparedAction.positionCollateralChange.before,
                    market.collateralAsset.decimals
                  ) * (market.collateralAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
                finalValue={formatNumber(
                  descaleBigIntToNumber(
                    preparedAction.positionCollateralChange.after,
                    market.collateralAsset.decimals
                  ) * (market.collateralAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
              />
            )}
            {repayAmount > 0 && (
              <MetricChange
                name={`Loan (${market.loanAsset.symbol})`}
                initialValue={formatNumber(
                  descaleBigIntToNumber(preparedAction.positionLoanChange.before, market.loanAsset.decimals) *
                    (market.loanAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
                finalValue={formatNumber(
                  descaleBigIntToNumber(preparedAction.positionLoanChange.after, market.loanAsset.decimals) *
                    (market.loanAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
              />
            )}
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
          <ActionFlowButton className="bg-accent-ternary">
            {repayAmount > 0 && "Repay"}
            {repayAmount > 0 && withdrawCollateralAmount > 0 && " & "}
            {withdrawCollateralAmount > 0 && "Withdraw Collateral"}
          </ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}

function computeCollateralWithdrawMax(repayAmount: number, position?: AccountMarketPositions[number]): number {
  if (!position?.market?.collateralAsset) {
    return 0;
  }

  if (position.market.lltv == 0 || position.market.collateralPriceInLoanAsset == 0) {
    return 0;
  }

  const collateral = descaleBigIntToNumber(position.collateralAssets, position.market.collateralAsset.decimals);
  const currentLoan = descaleBigIntToNumber(position.borrowAssets, position.market.loanAsset.decimals);
  const newLoan = currentLoan - repayAmount;
  const minRequiredCollateral =
    newLoan / (position.market.lltv - MAX_BORROW_LTV_MARGIN) / position.market.collateralPriceInLoanAsset;
  const collateralWithdrawMax = collateral - minRequiredCollateral;
  return Math.max(collateralWithdrawMax, 0);
}
