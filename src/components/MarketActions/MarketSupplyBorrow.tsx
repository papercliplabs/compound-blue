"use client";
import {
  ActionFlowButton,
  ActionFlowDialog,
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
import { descaleBigIntToNumber, formatNumber, numberToString } from "@/utils/format";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import AssetFormField from "../AssetFormField";
import { MarketActionsProps } from ".";
import {
  prepareMarketSupplyBorrowAction,
  PrepareMarketSupplyBorrowActionReturnType,
} from "@/actions/prepareMarketSupplyBorrowAction";
import { MarketId } from "@morpho-org/blue-sdk";
import { MAX_BORROW_LTV_MARGIN } from "@/config";

export default function MarketSupplyBorrow({
  market,
  onCloseAfterSuccess,
}: MarketActionsProps & { onCloseAfterSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<PrepareMarketSupplyBorrowActionReturnType | undefined>(
    undefined
  );
  const [success, setSuccess] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: userCollateralTokenHolding } = useUserTokenHolding(getAddress(market.collateralAsset.address));
  const { data: userPosition } = useUserMarketPosition(market.marketId as MarketId);

  const descaledCollateralTokenBalance = useMemo(
    () =>
      userCollateralTokenHolding
        ? descaleBigIntToNumber(userCollateralTokenHolding.balance, market.collateralAsset.decimals)
        : undefined,
    [userCollateralTokenHolding, market.collateralAsset.decimals]
  );

  const formSchema = useMemo(() => {
    return z.object({
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
      borrowAmount: z.string().optional().pipe(z.coerce.number().nonnegative().optional()),
    });
  }, [descaledCollateralTokenBalance]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  // Clear the form on flow completion
  const onFlowCompletion = useCallback(() => {
    form.reset();
    setSuccess(true);
  }, [form, setSuccess]);

  const supplyCollateralAmount = Number(form.watch("supplyCollateralAmount") ?? 0);
  const borrowAmount = Number(form.watch("borrowAmount") ?? 0);

  const descaledBorrowMax = useMemo(() => {
    const currentCollateralDescaled = descaleBigIntToNumber(
      userPosition?.collateralAssets ?? BigInt(0),
      market.collateralAsset.decimals
    );
    const newTotalCollateralDescaled = currentCollateralDescaled + supplyCollateralAmount;
    const maxTotalLoanDescaled =
      newTotalCollateralDescaled * market.collateralPriceInLoanAsset * (market.lltv - MAX_BORROW_LTV_MARGIN);

    return (
      maxTotalLoanDescaled - descaleBigIntToNumber(userPosition?.borrowAssets ?? BigInt(0), market.loanAsset.decimals)
    );
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

      const { supplyCollateralAmount = 0, borrowAmount = 0 } = values;

      // Final form validation
      if (borrowAmount == 0 && supplyCollateralAmount == 0) {
        // At least one must be set
        form.setError("borrowAmount", { message: "Amount is required." });
        form.setError("supplyCollateralAmount", { message: "Amount is required." });
        return;
      }

      if (borrowAmount > descaledBorrowMax) {
        form.setError("borrowAmount", { message: "Amount exceeds borrow capacity." });
        return;
      }

      setSimulatingBundle(true);

      // uint256 max for entire collateral balance
      const supplyCollateralAmountBigInt =
        supplyCollateralAmount > 0 && supplyCollateralAmount == descaledCollateralTokenBalance
          ? maxUint256
          : parseUnits(numberToString(supplyCollateralAmount), market.collateralAsset.decimals);

      const borrowAmountBigInt = parseUnits(numberToString(borrowAmount), market.loanAsset.decimals);

      const preparedAction = await prepareMarketSupplyBorrowAction({
        publicClient,
        accountAddress: address,
        marketId: market.marketId as MarketId,
        supplyCollateralAmount: supplyCollateralAmountBigInt,
        borrowAmount: borrowAmountBigInt,
        requiresReallocation: false, // TODO: handle this case...
      });

      setPreparedAction(preparedAction);

      if (preparedAction.status === "success") {
        setOpen(true);
      }

      setSimulatingBundle(false);
    },
    [publicClient, address, market, openConnectModal, descaledCollateralTokenBalance, descaledBorrowMax, form]
  );

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={simulatingBundle || open} style={{ all: "unset", width: "100%" }}>
            <div className="flex w-full flex-col space-y-8 overflow-hidden">
              <AssetFormField
                control={form.control}
                name="supplyCollateralAmount"
                actionName="Add"
                asset={market.collateralAsset}
                descaledAvailableBalance={descaledCollateralTokenBalance}
              />
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
                <Button type="submit" className="w-full bg-accent-ternary" disabled={simulatingBundle}>
                  {simulatingBundle ? "Simulating..." : "Review"}
                </Button>
                {preparedAction?.status == "error" && (
                  <p className="max-h-[50px] overflow-y-auto text-semantic-negative paragraph-sm">
                    {preparedAction.message}
                  </p>
                )}
              </div>
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
            {supplyCollateralAmount > 0 && (
              <ActionFlowSummaryAssetItem
                asset={market.collateralAsset}
                actionName="Add"
                descaledAmount={supplyCollateralAmount}
                amountUsd={supplyCollateralAmount * (market.collateralAsset.priceUsd ?? 0)}
              />
            )}
            {borrowAmount > 0 && (
              <ActionFlowSummaryAssetItem
                asset={market.loanAsset}
                actionName="Borrow"
                descaledAmount={borrowAmount}
                amountUsd={borrowAmount * (market.loanAsset.priceUsd ?? 0)}
              />
            )}
          </ActionFlowSummary>
          <ActionFlowReview className="flex flex-col gap-4">
            {supplyCollateralAmount > 0 && (
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
            {borrowAmount > 0 && (
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
          <ActionFlowButton className="bg-accent-ternary">
            {supplyCollateralAmount > 0 && "Supply Collateral"}
            {supplyCollateralAmount > 0 && borrowAmount > 0 && " and "}
            {borrowAmount > 0 && "Borrow"}
          </ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
