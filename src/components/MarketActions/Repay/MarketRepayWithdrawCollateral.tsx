"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { MarketId, MathLib, ORACLE_PRICE_SCALE } from "@morpho-org/blue-sdk";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { getAddress, maxUint256, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { z } from "zod";

import {
  MarketRepayAndWithdrawCollateralAction,
  marketRepayAndWithdrawCollateralAction,
} from "@/actions/market/marketRepayAndWithdrawCollateralAction";
import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowReview,
  ActionFlowSummary,
  ActionFlowSummaryAssetItem,
} from "@/components/ActionFlowDialog";
import AssetFormField from "@/components/FormFields/AssetFormField";
import { Form } from "@/components/ui/form";
import { MAX_BORROW_LTV_MARGIN } from "@/config";
import { MarketNonIdle } from "@/data/whisk/getMarket";
import { useAccountMarketPosition } from "@/hooks/useAccountMarketPosition";
import { useAccountTokenHolding } from "@/hooks/useAccountTokenHolding";
import { useWatchParseUnits } from "@/hooks/useWatch";
import { bigIntMax, bigIntMin } from "@/utils/bigint";
import { formatNumber } from "@/utils/format";

import { MetricChange } from "../../MetricChange";
import { Button } from "../../ui/button";
import PoweredByMorpho from "../../ui/icons/PoweredByMorpho";

export default function MarketRepayWithdrawCollateral({
  market,
  onCloseAfterSuccess,
}: {
  market: MarketNonIdle;
  onCloseAfterSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<MarketRepayAndWithdrawCollateralAction | undefined>(undefined);
  const [success, setSuccess] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: userLoanTokenHolding } = useAccountTokenHolding(getAddress(market.loanAsset.address));
  const { data: userPosition } = useAccountMarketPosition(market.marketId as MarketId);

  const computeRawMaxCollateralWithdraw = useCallback(
    (repayAmount: bigint) => {
      if (!userPosition || market.lltv == 0 || BigInt(market.rawCollateralPriceInLoanAsset) == 0n) {
        return 0n;
      }

      const newBorrowAssets = bigIntMax(BigInt(userPosition.borrowAssets) - repayAmount, 0n);

      // Following https://github.com/morpho-org/sdks/blob/main/packages/blue-sdk/src/market/MarketUtils.ts#L390-L418
      return MathLib.zeroFloorSub(
        userPosition.collateralAssets,
        MathLib.wDivUp(
          MathLib.mulDivUp(newBorrowAssets, ORACLE_PRICE_SCALE, market.rawCollateralPriceInLoanAsset),
          parseUnits((market.lltv - MAX_BORROW_LTV_MARGIN).toString(), 18) // Scaled by WAD
        )
      );
    },
    [market.lltv, market.rawCollateralPriceInLoanAsset, userPosition]
  );

  const formSchema = useMemo(() => {
    return z
      .object({
        repayAmount: z
          .string({ required_error: "Amount is required." }) // Means it can't be undefined, but empty string is valid
          .refine((val) => !isNaN(parseFloat(val)), "Amount must be a valid number.")
          .refine((val) => parseUnits(val, market.loanAsset.decimals) > 0n, "Amount must be greater than zero.") // This also catches the case where val is lower than token precision, but we prevent this in ActionFlowSummaryAssetItem
          .refine((val) => {
            if (userPosition == undefined) {
              return true;
            }

            const rawRepayAmount = parseUnits(val, market.loanAsset.decimals);
            const rawLoanAmount = BigInt(userPosition.borrowAssets);
            return rawRepayAmount <= rawLoanAmount;
          }, "Amount exceeds loan amount.")
          .refine((val) => {
            if (userLoanTokenHolding == undefined) {
              return true;
            }

            const rawRepayAmount = parseUnits(val, market.loanAsset.decimals);
            const rawLoanAssetBalance = BigInt(userLoanTokenHolding.balance);
            return rawRepayAmount <= rawLoanAssetBalance;
          }, "Amount exceeds wallet balance.")
          .or(z.literal("")),
        isMaxRepay: z.boolean(),
        withdrawCollateralAmount: z
          .string({ required_error: "Amount is required." }) // Means it can't be undefined, but empty string is valid
          .refine((val) => !isNaN(parseFloat(val)), "Amount must be a valid number.")
          .refine((val) => parseUnits(val, market.collateralAsset.decimals) > 0n, "Amount must be greater than zero.") // This also catches the case where val is lower than token precision, but we prevent this in ActionFlowSummaryAssetItem
          .or(z.literal("")),
      })
      .refine(
        (data) => {
          if (!userPosition) {
            return true;
          }

          const rawRepayAmount = data.repayAmount == "" ? 0n : parseUnits(data.repayAmount, market.loanAsset.decimals);
          const maxRawCollateralWithdraw = computeRawMaxCollateralWithdraw(rawRepayAmount);

          const rawWithdrawCollateralAmount =
            data.withdrawCollateralAmount == ""
              ? 0n
              : parseUnits(data.withdrawCollateralAmount, market.collateralAsset.decimals);

          return rawWithdrawCollateralAmount <= maxRawCollateralWithdraw;
        },
        {
          message: "Causes unhealthy position.",
          path: ["withdrawCollateralAmount"],
        }
      );
  }, [
    market.loanAsset.decimals,
    market.collateralAsset.decimals,
    userPosition,
    userLoanTokenHolding,
    computeRawMaxCollateralWithdraw,
  ]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onTouched",
    resolver: zodResolver(formSchema),
    defaultValues: {
      repayAmount: "",
      withdrawCollateralAmount: "",
      isMaxRepay: false,
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

      const { repayAmount, withdrawCollateralAmount } = values;
      setSimulatingBundle(true);

      let rawRepayAmount = repayAmount == "" ? 0n : parseUnits(repayAmount, market.loanAsset.decimals);
      let rawWithdrawCollateralAmount =
        withdrawCollateralAmount == "" ? 0n : parseUnits(withdrawCollateralAmount, market.collateralAsset.decimals);

      if (
        rawRepayAmount > 0n &&
        rawRepayAmount == BigInt(userPosition?.borrowAssets ?? "0") // Can't use isMax since this could be limited by wallet balance instead of full position
      ) {
        // Repaying full position
        rawRepayAmount = maxUint256;
      }

      if (
        rawWithdrawCollateralAmount > 0n &&
        rawWithdrawCollateralAmount == BigInt(userPosition?.collateralAssets ?? "0") // Can't use isMax since max could be not full position
      ) {
        // Withdrawing all collateral
        rawWithdrawCollateralAmount = maxUint256;
      }

      const preparedAction = await marketRepayAndWithdrawCollateralAction({
        publicClient,
        accountAddress: address,
        marketId: market.marketId as MarketId,
        repayAmount: rawRepayAmount,
        withdrawCollateralAmount: rawWithdrawCollateralAmount,
      });

      setPreparedAction(preparedAction);

      if (preparedAction.status === "success") {
        setOpen(true);
      }

      setSimulatingBundle(false);
    },
    [
      address,
      publicClient,
      market.loanAsset.decimals,
      market.collateralAsset.decimals,
      market.marketId,
      userPosition?.borrowAssets,
      userPosition?.collateralAssets,
      openConnectModal,
    ]
  );

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
    setSuccess(true);
  }, [form, setSuccess]);

  const rawRepayAmount = useWatchParseUnits({
    control: form.control,
    name: "repayAmount",
    decimals: market.loanAsset.decimals,
  });
  const rawWithdrawCollateralAmount = useWatchParseUnits({
    control: form.control,
    name: "withdrawCollateralAmount",
    decimals: market.collateralAsset.decimals,
  });

  // Anytime the repayAmount changes, trigger the withdrawCollateralAmount validation since it depends on it
  useEffect(() => {
    void form.trigger("withdrawCollateralAmount");
  }, [rawRepayAmount, form]);

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
                  rawAvailableBalance={
                    userPosition && userLoanTokenHolding
                      ? bigIntMin(BigInt(userPosition.borrowAssets), BigInt(userLoanTokenHolding.balance))
                      : undefined
                  }
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
                rawAvailableBalance={computeRawMaxCollateralWithdraw(rawRepayAmount)}
              />

              <div className="flex min-w-0 flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  variant="borrow"
                  disabled={
                    simulatingBundle ||
                    !form.formState.isValid ||
                    (rawRepayAmount == 0n && rawWithdrawCollateralAmount == 0n)
                  }
                  isLoading={simulatingBundle}
                  loadingMessage="Simulating"
                >
                  {rawRepayAmount == 0n && rawWithdrawCollateralAmount == 0n ? "Enter Amount" : "Review"}
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
            {rawRepayAmount > 0n && (
              <ActionFlowSummaryAssetItem
                asset={market.loanAsset}
                actionName="Repay"
                side="borrow"
                isIncreasing={false}
                rawAmount={rawRepayAmount}
              />
            )}
            {rawWithdrawCollateralAmount > 0n && (
              <ActionFlowSummaryAssetItem
                asset={market.collateralAsset}
                actionName="Withdraw"
                side="supply"
                isIncreasing={false}
                rawAmount={rawWithdrawCollateralAmount}
              />
            )}
          </ActionFlowSummary>
          <ActionFlowReview className="flex flex-col gap-4">
            {rawWithdrawCollateralAmount > 0n && (
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
            {rawRepayAmount > 0n && (
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
            {rawRepayAmount > 0n && "Repay"}
            {rawRepayAmount > 0n && rawWithdrawCollateralAmount > 0n && " & "}
            {rawWithdrawCollateralAmount > 0n && "Withdraw Collateral"}
          </ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
