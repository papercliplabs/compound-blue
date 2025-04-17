"use client";
import { DialogDrawer, DialogDrawerContent, DialogDrawerTitle } from "../ui/dialogDrawer";
import { Button } from "../ui/button";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { descaleBigIntToNumber, formatNumber, numberToString } from "@/utils/format";
import { zodResolver } from "@hookform/resolvers/zod";
import AssetFormField, { AssetFormFieldViewOnly } from "@/components/FormFields/AssetFormField";
import { useAccount } from "wagmi";
import { usePublicClient } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAddress, maxUint256, parseUnits } from "viem";
import { PrepareActionReturnType } from "@/actions/helpers";
import { ActionFlowButton, ActionFlowReview, ActionFlowSummary, ActionFlowSummaryAssetItem } from "../ActionFlowDialog";
import { ActionFlowDialog } from "../ActionFlowDialog";
import { ArrowDown, ArrowRight } from "lucide-react";
import NumberFlow from "../ui/NumberFlow";
import Image from "next/image";
import { MetricChange } from "../MetricChange";
import Apy from "../Apy";
import { MigratableAaveV3BorrowPosition } from "@/hooks/useMigratableAaveV3BorrowPosition";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { prepareAaveV3MarketMigrationAction } from "@/actions/prepareAaveV3MarketMigrationAction";
import { MarketId } from "@morpho-org/blue-sdk";
import { MarketIdentifier } from "../MarketIdentifier";
import { computeAaveNewLltv, computeAaveEffectiveBorrowApy } from "@/utils/aave";
import { TooltipPopover, TooltipPopoverTrigger, TooltipPopoverContent } from "../ui/tooltipPopover";
import LtvBar from "../LtvBar";
import { computeLtvHealth } from "@/utils/ltv";
import clsx from "clsx";

const LTV_ROUNDING_THRESHOLD = 0.0001;

interface MarketMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  migratableAaveV3BorrowPosition: MigratableAaveV3BorrowPosition;
  market: MarketSummary;
}

export default function MarketMigrationAction({
  open,
  onOpenChange,
  migratableAaveV3BorrowPosition: {
    aaveV3CollateralReservePosition,
    aaveV3LoanReservePosition,
    aaveFullPositionMetrics,
    destinationMarketPosition,
  },
  market,
}: MarketMigrationDialogProps) {
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [txFlowOpen, setTxFlowOpen] = useState(false);
  const [preparedAction, setPreparedAction] = useState<PrepareActionReturnType | undefined>(undefined);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const { collateralAsset, loanAsset } = useMemo(() => {
    return {
      collateralAsset: destinationMarketPosition.market!.collateralAsset!,
      loanAsset: destinationMarketPosition.market!.loanAsset,
    };
  }, [destinationMarketPosition]);

  const { collateralBalance, loanBalance } = useMemo(() => {
    const collateralBalance = descaleBigIntToNumber(
      aaveV3CollateralReservePosition.aTokenAssets,
      aaveV3CollateralReservePosition.reserve.aToken.decimals
    );
    const loanBalance = descaleBigIntToNumber(
      aaveV3LoanReservePosition.borrowAssets,
      aaveV3LoanReservePosition.reserve.underlyingAsset.decimals
    );
    return {
      collateralBalance,
      loanBalance,
    };
  }, [aaveV3CollateralReservePosition, aaveV3LoanReservePosition]);

  const formSchema = useMemo(() => {
    return z.object({
      collateralMigrateAmount: z.coerce
        .string()
        .refine((val) => Number(val) <= collateralBalance, "Amount exceeds wallet balance.")
        .transform((val) => Number(val)),
      isMaxCollateral: z.boolean(),
      loanMigrateAmount: z.coerce
        .string()
        .refine((val) => Number(val) <= loanBalance, "Amount exceeds loan balance.")
        .transform((val) => Number(val)),
      isMaxLoan: z.boolean(),
    });
  }, [collateralBalance, loanBalance]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      collateralMigrateAmount: collateralBalance,
      isMaxCollateral: true,
      loanMigrateAmount: loanBalance,
      isMaxLoan: true,
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

      setSimulatingBundle(true);

      // Uint256 max if the user wants to supply their entire balance
      const { collateralMigrateAmount, loanMigrateAmount, isMaxCollateral, isMaxLoan } = values;

      const rawCollateralMigrateAmount = isMaxCollateral
        ? maxUint256
        : parseUnits(numberToString(collateralMigrateAmount), aaveV3CollateralReservePosition.reserve.aToken.decimals);

      const rawLoanMigrateAmount = isMaxLoan
        ? maxUint256
        : parseUnits(numberToString(loanMigrateAmount), aaveV3LoanReservePosition.reserve.underlyingAsset.decimals);

      const preparedAction = await prepareAaveV3MarketMigrationAction({
        publicClient,
        accountAddress: address,
        marketId: market.marketId as MarketId,
        collateralTokenAmount: rawCollateralMigrateAmount,
        loanTokenAmount: rawLoanMigrateAmount,

        allocatingVaultAddresses: market.vaultAllocations.map((allocation) =>
          getAddress(allocation.vault.vaultAddress)
        ),
      });

      setPreparedAction(preparedAction);

      if (preparedAction.status === "success") {
        onOpenChange(false);
        setTxFlowOpen(true);
      }

      setSimulatingBundle(false);
    },
    [
      address,
      openConnectModal,
      publicClient,
      market,
      aaveV3CollateralReservePosition,
      aaveV3LoanReservePosition,
      onOpenChange,
    ]
  );

  // Reset form on new vaultReservePositionPairing
  useEffect(() => {
    form.reset({
      collateralMigrateAmount: collateralBalance,
      isMaxCollateral: true,
      loanMigrateAmount: loanBalance,
      isMaxLoan: true,
    });
  }, [
    destinationMarketPosition,
    aaveV3CollateralReservePosition,
    aaveV3LoanReservePosition,
    collateralBalance,
    loanBalance,
    form,
  ]);

  const collateralMigrateAmount = Number(form.watch("collateralMigrateAmount") ?? 0);
  const loanMigrateAmount = Number(form.watch("loanMigrateAmount") ?? 0);
  const collateralMigrateAmountUsd =
    collateralMigrateAmount * aaveV3CollateralReservePosition.reserve.underlyingAsset.priceUsd;
  const loanMigrateAmountUsd = loanMigrateAmount * aaveV3LoanReservePosition.reserve.underlyingAsset.priceUsd;

  const netApyMetricChange = useMemo(() => {
    const effectiveAaveV3BorrowApy = computeAaveEffectiveBorrowApy(
      collateralMigrateAmountUsd,
      aaveV3CollateralReservePosition.reserve.supplyApy.total,
      loanMigrateAmountUsd,
      aaveV3LoanReservePosition.reserve.borrowApy.total
    );
    return (
      <MetricChange
        name="Net APY"
        initialValue={
          <TooltipPopover>
            <TooltipPopoverTrigger>
              <NumberFlow value={effectiveAaveV3BorrowApy} format={{ style: "percent" }} />
            </TooltipPopoverTrigger>
            <TooltipPopoverContent>
              <p>The AAVE net borrow APY is the weighted average of the borrow APY, and the collateral supply APY.</p>
            </TooltipPopoverContent>
          </TooltipPopover>
        }
        finalValue={<Apy type="borrow" apy={destinationMarketPosition.market!.borrowApy} />}
      />
    );
  }, [
    collateralMigrateAmountUsd,
    aaveV3CollateralReservePosition,
    loanMigrateAmountUsd,
    aaveV3LoanReservePosition,
    destinationMarketPosition,
  ]);

  const { simulatedAaveLtv, simulatedAaveLltv, simulatedMarketPositionLtv, aaveLtvHealth, morphoLtvHealth } =
    useMemo(() => {
      const newAaveCollateralUsd = aaveFullPositionMetrics.totalCollateralUsd - collateralMigrateAmountUsd;
      const newAaveBorrowUsd = aaveFullPositionMetrics.totalBorrowUsd - loanMigrateAmountUsd;
      let simulatedAaveLtv;
      if (newAaveBorrowUsd < LTV_ROUNDING_THRESHOLD) {
        simulatedAaveLtv = 0;
      } else if (newAaveCollateralUsd == 0) {
        simulatedAaveLtv = 1;
      } else {
        simulatedAaveLtv = newAaveBorrowUsd / newAaveCollateralUsd;
      }

      const simulatedAaveLltv = computeAaveNewLltv(
        aaveFullPositionMetrics.totalCollateralUsd,
        aaveFullPositionMetrics.lltv,
        -collateralMigrateAmountUsd,
        aaveV3CollateralReservePosition.lltvEffective
      );

      const newMarketCollateralUsd = destinationMarketPosition.collateralAssetsUsd + collateralMigrateAmountUsd;
      const newMarketBorrowUsd = destinationMarketPosition.borrowAssetsUsd + loanMigrateAmountUsd;
      const simulatedMarketPositionLtv = newMarketBorrowUsd > 0 ? newMarketBorrowUsd / newMarketCollateralUsd : 0;
      return {
        simulatedAaveLtv,
        simulatedAaveLltv,
        simulatedMarketPositionLtv,
        aaveLtvHealth: computeLtvHealth(simulatedAaveLtv, simulatedAaveLltv),
        morphoLtvHealth: computeLtvHealth(simulatedMarketPositionLtv, destinationMarketPosition.market?.lltv),
      };
    }, [
      aaveFullPositionMetrics,
      loanMigrateAmountUsd,
      collateralMigrateAmountUsd,
      destinationMarketPosition,
      aaveV3CollateralReservePosition,
    ]);

  return (
    <>
      <DialogDrawer open={open} onOpenChange={onOpenChange}>
        <DialogDrawerContent className="lg:max-w-[800px]">
          <DialogDrawerTitle>Migrate Position</DialogDrawerTitle>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <fieldset disabled={simulatingBundle || txFlowOpen} style={{ all: "unset", width: "100%" }}>
                <div className="flex w-full flex-col gap-7 overflow-hidden">
                  <div className="flex flex-col items-center gap-4 md:flex-row">
                    <div className="flex w-full flex-1 flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <Image src="/aave.png" width={32} height={32} className="rounded-full" alt="Aave" />
                        <div className="flex flex-col justify-between">
                          <span className="label-lg">Aave v3</span>
                          <span className="text-content-secondary label-sm">Protocol</span>
                        </div>
                      </div>
                      <div
                        className={clsx("h-full rounded-[12px] p-[3px] transition-colors", {
                          "bg-background-positive": aaveLtvHealth === "healthy",
                          "bg-background-warning": aaveLtvHealth === "warning",
                          "bg-background-negative": aaveLtvHealth === "unhealthy",
                        })}
                      >
                        <div className="flex flex-col gap-6 rounded-[12px] bg-background-secondary p-6">
                          <AssetFormField
                            control={form.control}
                            name="collateralMigrateAmount"
                            actionName="Withdraw"
                            asset={aaveV3CollateralReservePosition.reserve.underlyingAsset}
                            descaledAvailableBalance={collateralBalance}
                            setIsMax={(isMax) => {
                              form.setValue("isMaxCollateral", isMax);
                            }}
                          />
                          <div className="h-[1px] w-full bg-border-primary" />
                          <div className="[&_label]:text-accent-ternary">
                            <AssetFormField
                              control={form.control}
                              name="loanMigrateAmount"
                              actionName="Repay"
                              asset={aaveV3LoanReservePosition.reserve.underlyingAsset}
                              descaledAvailableBalance={loanBalance}
                              setIsMax={(isMax) => {
                                form.setValue("isMaxLoan", isMax);
                              }}
                            />
                          </div>
                        </div>
                        <div className="px-6 py-4">
                          <LtvBar ltv={simulatedAaveLtv} lltv={simulatedAaveLltv} />
                        </div>
                      </div>
                    </div>

                    <ArrowDown size={16} className="stroke-content-primary md:mt-[56px] md:-rotate-90" />

                    <div className="flex h-full w-full flex-1 flex-col gap-4">
                      <MarketIdentifier {...market} />
                      <div
                        className={clsx("rounded-[12px] p-[3px] transition-colors", {
                          "bg-background-positive": morphoLtvHealth === "healthy",
                          "bg-background-warning": morphoLtvHealth === "warning",
                          "bg-background-negative": morphoLtvHealth === "unhealthy",
                        })}
                      >
                        <div className="flex flex-col gap-6 rounded-[12px] bg-background-secondary p-6">
                          <AssetFormFieldViewOnly
                            actionName="Add"
                            asset={collateralAsset}
                            amount={collateralMigrateAmount}
                            amountUsd={collateralMigrateAmountUsd}
                          />
                          <div className="h-[1px] w-full bg-border-primary" />
                          <div className="[&_label]:text-accent-ternary">
                            <AssetFormFieldViewOnly
                              actionName="Borrow"
                              asset={loanAsset}
                              amount={loanMigrateAmount}
                              amountUsd={loanMigrateAmountUsd}
                            />
                          </div>
                        </div>
                        <div className="px-6 py-4">
                          <LtvBar ltv={simulatedMarketPositionLtv} lltv={destinationMarketPosition.market?.lltv} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-[1px] w-full bg-border-primary" />

                  <div className="flex flex-col gap-5">{netApyMetricChange}</div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Button
                      type="submit"
                      className="w-full bg-accent-ternary"
                      disabled={
                        simulatingBundle ||
                        !form.formState.isValid ||
                        aaveLtvHealth == "unhealthy" ||
                        morphoLtvHealth == "unhealthy"
                      }
                    >
                      {collateralMigrateAmount == 0 && loanMigrateAmount == 0
                        ? "Enter Amount"
                        : simulatingBundle
                          ? "Simulating..."
                          : "Review Migration"}
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
        </DialogDrawerContent>
      </DialogDrawer>

      {preparedAction?.status == "success" && (
        <ActionFlowDialog
          open={txFlowOpen}
          onOpenChange={(open) => {
            setTxFlowOpen(open);
          }}
          signatureRequests={preparedAction?.status == "success" ? preparedAction?.signatureRequests : []}
          transactionRequests={preparedAction?.status == "success" ? preparedAction?.transactionRequests : []}
          flowCompletionCb={() => {
            onOpenChange(false);
          }}
        >
          <ActionFlowSummary>
            <ActionFlowSummaryAssetItem
              asset={destinationMarketPosition.market!.loanAsset}
              actionName="Migrate"
              side="borrow"
              isIncreasing={true}
              descaledAmount={collateralMigrateAmount}
              amountUsd={collateralMigrateAmountUsd}
              protocolName="Compound Blue"
            />
            <ActionFlowSummaryAssetItem
              asset={destinationMarketPosition.market!.collateralAsset!}
              actionName="Borrow"
              side="supply"
              isIncreasing={true}
              descaledAmount={loanMigrateAmount}
              amountUsd={loanMigrateAmountUsd}
              protocolName="Compound Blue"
            />
          </ActionFlowSummary>
          <ActionFlowReview>
            <MetricChange
              name={`Collateral (${destinationMarketPosition.market!.collateralAsset!.symbol})`}
              initialValue={
                <NumberFlow value={destinationMarketPosition.collateralAssetsUsd} format={{ currency: "USD" }} />
              }
              finalValue={
                <NumberFlow
                  value={destinationMarketPosition.collateralAssetsUsd + collateralMigrateAmountUsd}
                  format={{ currency: "USD" }}
                />
              }
            />
            <MetricChange
              name={`Loan (${destinationMarketPosition.market!.loanAsset.symbol})`}
              initialValue={
                <NumberFlow value={destinationMarketPosition.borrowAssetsUsd} format={{ currency: "USD" }} />
              }
              finalValue={
                <NumberFlow
                  value={destinationMarketPosition.borrowAssetsUsd + loanMigrateAmountUsd}
                  format={{ currency: "USD" }}
                />
              }
            />
            <div className="flex items-center justify-between">
              <span>LTV / LLTV</span>
              <div className="flex items-center gap-1 label-md">
                <span className="text-content-secondary">
                  (
                  {formatNumber(destinationMarketPosition.ltv, {
                    style: "percent",
                  })}
                </span>
                <ArrowRight size={14} className="stroke-content-secondary" />
                {formatNumber(simulatedMarketPositionLtv, {
                  style: "percent",
                })}
                ) / {formatNumber(market.lltv, { style: "percent" })}
              </div>
            </div>
          </ActionFlowReview>
          <ActionFlowButton>Migrate</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
