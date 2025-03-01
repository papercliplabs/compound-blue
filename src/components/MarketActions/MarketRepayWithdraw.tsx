"use client";
import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowError,
  ActionFlowReview,
  ActionFlowReviewItem,
  ActionFlowSummary,
  ActionFlowSummaryAssetItem,
} from "@/components/ActionFlowDialog";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { useAccount, usePublicClient } from "wagmi";
import { useUserMarketPosition, useUserTokenHolding } from "@/providers/UserPositionProvider";
import { getAddress, maxUint256, parseUnits } from "viem";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import AssetFormField from "../AssetFormField";
import { MarketActionsProps } from ".";
import { MarketId } from "@morpho-org/blue-sdk";
import {
  prepareMarketRepayWithdrawAction,
  PrepareMarketRepayWithdrawActionReturnType,
} from "@/actions/prepareMarketRepayWithdrawAction";

const MAX_BORROW_LTV_MARGIN = 0.05; // Only allow a max borrow origination of up to 5% below LLTV

export default function MarketRepayWithdraw({ market }: MarketActionsProps) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<PrepareMarketRepayWithdrawActionReturnType | undefined>(
    undefined
  );

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: userLoanTokenHolding } = useUserTokenHolding(getAddress(market.loanAsset.address));
  const { data: userPosition } = useUserMarketPosition(market.marketId as MarketId);

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
    return z.object({
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
      withdrawCollateralAmount: z.string().optional().pipe(z.coerce.number().nonnegative().optional()), // Do max validaiton in on submit
    });
  }, [descaledLoanAmount, descaledLoanAssetBalance]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
  }, [form]);

  const repayAmount = form.watch("repayAmount") ?? 0;
  const withdrawCollateralAmount = form.watch("withdrawCollateralAmount") ?? 0;

  const { descaledCollateralWithdrawMax, descaledPositionCollateralAmount } = useMemo(() => {
    const newLoanAmount = Math.max(
      descaleBigIntToNumber(userPosition?.borrowAssets ?? BigInt(0), market.loanAsset.decimals) - repayAmount,
      0
    );

    if (market.lltv > 0 && market.collateralPriceInLoanAsset > 0) {
      const requiredCollateralAmount =
        newLoanAmount / (market.lltv - MAX_BORROW_LTV_MARGIN) / market.collateralPriceInLoanAsset;
      const descaledCurrentCollateralAmount = descaleBigIntToNumber(
        userPosition?.collateralAssets ?? BigInt(0),
        market.collateralAsset?.decimals ?? 18
      );

      return {
        descaledCollateralWithdrawMax: descaledCurrentCollateralAmount - requiredCollateralAmount,
        descaledPositionCollateralAmount: descaledCurrentCollateralAmount,
      };
    } else {
      // Something wrong with the market config...
      // Clamp to 0
      return {
        descaledCollateralWithdrawMax: 0,
        descaledPositionCollateralAmount: 0,
      };
    }
  }, [userPosition, repayAmount, market]);

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

      // Final form validation
      if (repayAmount == 0 && withdrawCollateralAmount == 0) {
        // At least one must be set
        form.setError("repayAmount", { message: "Amount is required." });
        form.setError("withdrawCollateralAmount", { message: "Amount is required." });
        return;
      }

      if (withdrawCollateralAmount > descaledCollateralWithdrawMax) {
        form.setError("withdrawCollateralAmount", { message: "Causes unhealthy position." });
        return;
      }

      setSimulatingBundle(true);

      // Max is closing full position
      const repayAmountBigInt =
        repayAmount > 0 && repayAmount == descaledLoanAmount
          ? maxUint256
          : parseUnits(repayAmount.toString(), market.loanAsset.decimals ?? 18);

      const withdrawCollateralAmountBigInt =
        withdrawCollateralAmount > 0 && withdrawCollateralAmount == descaledPositionCollateralAmount
          ? maxUint256
          : parseUnits(withdrawCollateralAmount.toString(), market.collateralAsset?.decimals ?? 18);

      const preparedAction = await prepareMarketRepayWithdrawAction({
        publicClient,
        accountAddress: address,
        marketId: market.marketId as MarketId,
        repayAmount: repayAmountBigInt,
        withdrawCollateralAmount: withdrawCollateralAmountBigInt,
      });

      setPreparedAction(preparedAction);

      if (preparedAction.status === "success") {
        setOpen(true);
      }

      setSimulatingBundle(false);
    },
    [
      publicClient,
      address,
      market,
      openConnectModal,
      descaledCollateralWithdrawMax,
      descaledPositionCollateralAmount,
      descaledLoanAmount,
      form,
    ]
  );

  if (!market.collateralAsset) {
    return null; // Handle, can't borrow from idle market...
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset
            disabled={simulatingBundle || open}
            style={{ all: "unset" }}
            className="flex w-full flex-col space-y-8 overflow-hidden"
          >
            <AssetFormField
              control={form.control}
              name="repayAmount"
              actionName="Repay"
              asset={market.loanAsset}
              descaledAvailableBalance={availableRepayAmount}
            />
            <div className="[&_label]:text-accent-ternary">
              <AssetFormField
                control={form.control}
                name="withdrawCollateralAmount"
                actionName="Withdraw"
                asset={market.collateralAsset}
                descaledAvailableBalance={descaledCollateralWithdrawMax}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <Button type="submit" className="w-full bg-accent-ternary" disabled={simulatingBundle}>
                {simulatingBundle ? "Simulating..." : "Review"}
              </Button>
              {preparedAction?.status == "error" && (
                <p className="max-h-[50px] overflow-y-auto font-medium text-semantic-negative paragraph-sm">
                  {preparedAction.message}
                </p>
              )}
            </div>
          </fieldset>
        </form>
      </Form>

      {preparedAction?.status == "success" && (
        <ActionFlowDialog
          open={open}
          onOpenChange={setOpen}
          signatureRequests={preparedAction?.status == "success" ? preparedAction?.signatureRequests : []}
          transactionRequests={preparedAction?.status == "success" ? preparedAction?.transactionRequests : []}
          flowCompletionCb={onFlowCompletion}
        >
          <ActionFlowSummary>
            {repayAmount > 0 && (
              <ActionFlowSummaryAssetItem
                asset={market.loanAsset}
                actionName="Repay"
                descaledAmount={repayAmount}
                amountUsd={repayAmount * (market.loanAsset.priceUsd ?? 0)}
              />
            )}
            {withdrawCollateralAmount > 0 && (
              <ActionFlowSummaryAssetItem
                asset={market.collateralAsset}
                actionName="Withdraw"
                descaledAmount={withdrawCollateralAmount}
                amountUsd={withdrawCollateralAmount * (market.collateralAsset.priceUsd ?? 0)}
              />
            )}
          </ActionFlowSummary>
          <ActionFlowReview className="flex flex-col gap-4 font-semibold">
            {withdrawCollateralAmount > 0 && (
              <ActionFlowReviewItem
                name={`Collateral (${market.collateralAsset.symbol})`}
                valueBefore={formatNumber(
                  descaleBigIntToNumber(
                    preparedAction.positionCollateralChange.before,
                    market.collateralAsset.decimals
                  ) * (market.collateralAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
                valueAfter={formatNumber(
                  descaleBigIntToNumber(
                    preparedAction.positionCollateralChange.after,
                    market.collateralAsset.decimals
                  ) * (market.collateralAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
              />
            )}
            {repayAmount > 0 && (
              <ActionFlowReviewItem
                name={`Loan (${market.loanAsset.symbol})`}
                valueBefore={formatNumber(
                  descaleBigIntToNumber(preparedAction.positionLoanChange.before, market.loanAsset.decimals) *
                    (market.loanAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
                valueAfter={formatNumber(
                  descaleBigIntToNumber(preparedAction.positionLoanChange.after, market.loanAsset.decimals) *
                    (market.loanAsset.priceUsd ?? 0),
                  { currency: "USD" }
                )}
              />
            )}
            <ActionFlowReviewItem
              name={`LTV`}
              valueBefore={formatNumber(descaleBigIntToNumber(preparedAction.positionLtvChange.before, 18), {
                style: "percent",
              })}
              valueAfter={formatNumber(descaleBigIntToNumber(preparedAction.positionLtvChange.after, 18), {
                style: "percent",
              })}
            />
          </ActionFlowReview>
          <div className="flex w-full flex-col gap-2">
            <ActionFlowButton className="bg-accent-ternary">
              {repayAmount > 0 && "Repay"}
              {repayAmount > 0 && withdrawCollateralAmount > 0 && " and "}
              {withdrawCollateralAmount > 0 && "Withdraw Collateral"}
            </ActionFlowButton>
            <ActionFlowError />
          </div>
        </ActionFlowDialog>
      )}
    </>
  );
}
