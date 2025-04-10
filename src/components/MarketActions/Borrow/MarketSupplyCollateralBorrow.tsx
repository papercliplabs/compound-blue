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
import { MarketActionsProps } from "..";
import {
  prepareMarketSupplyCollateralBorrowAction,
  PrepareMarketSupplyCollateralBorrowActionReturnType,
} from "@/actions/prepareMarketSupplyCollateralBorrowAction";
import { MarketId } from "@morpho-org/blue-sdk";
import { MAX_BORROW_LTV_MARGIN, PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION } from "@/config";
import PoweredByMorpho from "../../ui/icons/PoweredByMorpho";
import { useAccountTokenHolding } from "@/hooks/useAccountTokenHolding";
import { useAccountMarketPosition } from "@/hooks/useAccountMarketPosition";
import { AccountMarketPositions } from "@/data/whisk/getAccountMarketPositions";
import { WAD } from "@/utils/constants";
import { ArrowRight } from "lucide-react";
import { MetricChange } from "../../MetricChange";

export default function MarketSupplyCollateralBorrow({
  market,
  onCloseAfterSuccess,
}: MarketActionsProps & { onCloseAfterSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [preparedAction, setPreparedAction] = useState<PrepareMarketSupplyCollateralBorrowActionReturnType | undefined>(
    undefined
  );
  const [success, setSuccess] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: userCollateralTokenHolding } = useAccountTokenHolding(getAddress(market.collateralAsset.address));
  const { data: userPosition } = useAccountMarketPosition(market.marketId as MarketId);

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
          const newBorrowMax = computeNewBorrowMax(data.supplyCollateralAmount ?? 0, userPosition);
          return (data.borrowAmount ?? 0) <= newBorrowMax;
        },
        {
          message: "Amount exceeds borrow capacity.",
          path: ["borrowAmount"],
        }
      );
  }, [descaledCollateralTokenBalance, userPosition]);

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
    form.trigger("borrowAmount");
  }, [supplyCollateralAmount, form]);

  const descaledBorrowMax = useMemo(() => {
    return computeNewBorrowMax(supplyCollateralAmount, userPosition);
  }, [userPosition, supplyCollateralAmount]);

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

      const supplyAssets = BigInt(market.supplyAssets);
      const newBorrowAssets = BigInt(market.borrowAssets) + borrowAmountBigInt;
      const newUtilization = supplyAssets > BigInt(0) ? (newBorrowAssets * WAD) / supplyAssets : BigInt(0);

      const preparedAction = await prepareMarketSupplyCollateralBorrowAction({
        publicClient,
        accountAddress: address,
        marketId: market.marketId as MarketId,
        allocatingVaultAddresses: market.vaultAllocations.map((allocation) =>
          getAddress(allocation.vault.vaultAddress)
        ),
        supplyCollateralAmount: supplyCollateralAmountBigInt,
        borrowAmount: borrowAmountBigInt,
        // This is just a hint for the simulator to assemble the entire vault + market state for a reallocation
        requiresReallocation: newUtilization > PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION,
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
                  className="w-full bg-accent-ternary"
                  disabled={
                    simulatingBundle || (borrowAmount == 0 && supplyCollateralAmount == 0) || !form.formState.isValid
                  }
                >
                  {borrowAmount == 0 && supplyCollateralAmount == 0
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
            {borrowAmount > 0 && (
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
            {supplyCollateralAmount > 0 && "Supply Collateral"}
            {supplyCollateralAmount > 0 && borrowAmount > 0 && " & "}
            {borrowAmount > 0 && "Borrow"}
          </ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}

function computeNewBorrowMax(newCollateral: number, position?: AccountMarketPositions[number]): number {
  if (!position?.market?.collateralAsset) {
    return 0;
  }

  const currentCollateral = descaleBigIntToNumber(position.collateralAssets, position.market.collateralAsset.decimals);
  const currentLoan = descaleBigIntToNumber(position.borrowAssets, position.market.loanAsset.decimals);
  const newTotalCollateral = currentCollateral + newCollateral;
  const maxLoan =
    newTotalCollateral * position.market.collateralPriceInLoanAsset * (position.market.lltv - MAX_BORROW_LTV_MARGIN);

  return Math.max(maxLoan - currentLoan, 0);
}
