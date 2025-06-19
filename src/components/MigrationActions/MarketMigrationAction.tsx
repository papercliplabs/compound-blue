"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { MarketId } from "@morpho-org/blue-sdk";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import clsx from "clsx";
import { ArrowDown, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { formatUnits, getAddress, maxUint256, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { usePublicClient } from "wagmi";
import { z } from "zod";

import { aaveV3MarketMigrationAction } from "@/actions/migration/aaveV3MarketMigrationAction";
import { Action } from "@/actions/utils/types";
import AssetFormField, { AssetFormFieldViewOnly } from "@/components/FormFields/AssetFormField";
import { Form } from "@/components/ui/form";
import { MarketMigrationTableEntry } from "@/hooks/useMarketMigrationTableData";
import { useWatchParseUnits } from "@/hooks/useWatch";
import { computeAaveEffectiveBorrowApy, computeAaveNewLltv } from "@/utils/aave";
import { calculateUsdValue, descaleBigIntToNumber, formatNumber } from "@/utils/format";
import { computeLtvHealth } from "@/utils/ltv";

import { ActionFlowButton, ActionFlowReview, ActionFlowSummary, ActionFlowSummaryAssetItem } from "../ActionFlowDialog";
import { ActionFlowDialog } from "../ActionFlowDialog";
import Apy from "../Apy";
import LtvBar from "../LtvBar";
import { MarketIdentifier } from "../MarketIdentifier";
import { MetricChange } from "../MetricChange";
import { Button } from "../ui/button";
import { DialogDrawer, DialogDrawerContent, DialogDrawerTitle } from "../ui/dialogDrawer";
import NumberFlow from "../ui/NumberFlow";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../ui/tooltipPopover";

const LTV_ROUNDING_THRESHOLD = 0.0001;

interface MarketMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  migrationData: MarketMigrationTableEntry;
}

export default function MarketMigrationAction({
  open,
  onOpenChange,
  migrationData: {
    aaveV3CollateralReservePosition,
    aaveV3LoanReservePosition,
    aaveFullPositionMetrics,
    destinationMarketPosition,
    destinationMarketSummary,
  },
}: MarketMigrationDialogProps) {
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [txFlowOpen, setTxFlowOpen] = useState(false);
  const [preparedAction, setPreparedAction] = useState<Action | undefined>(undefined);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const { collateralAsset, loanAsset } = useMemo(() => {
    return {
      collateralAsset: destinationMarketSummary.collateralAsset!,
      loanAsset: destinationMarketSummary.loanAsset,
    };
  }, [destinationMarketSummary]);

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
      collateralMigrateAmount: z
        .string({ required_error: "Amount is required" })
        .nonempty("Amount is required.")
        .refine((val) => !isNaN(parseFloat(val)), "Amount must be a valid number.")
        .refine(
          (val) => parseUnits(val, aaveV3CollateralReservePosition.reserve.aToken.decimals) > 0n,
          "Amount must be greater than zero."
        )
        .refine((val) => {
          const rawVal = parseUnits(val, aaveV3CollateralReservePosition.reserve.aToken.decimals);
          return rawVal <= BigInt(aaveV3CollateralReservePosition.aTokenAssets);
        }, "Amount exceeds wallet balance."),
      isMaxCollateral: z.boolean(),
      loanMigrateAmount: z
        .string({ required_error: "Amount is required" })
        .nonempty("Amount is required.")
        .refine((val) => !isNaN(parseFloat(val)), "Amount must be a valid number.")
        .refine(
          (val) => parseUnits(val, aaveV3LoanReservePosition.reserve.underlyingAsset.decimals) > 0n,
          "Amount must be greater than zero."
        )
        .refine((val) => {
          const rawVal = parseUnits(val, aaveV3LoanReservePosition.reserve.underlyingAsset.decimals);
          return rawVal <= BigInt(aaveV3LoanReservePosition.borrowAssets);
        }, "Amount exceeds loan balance."),
      isMaxLoan: z.boolean(),
    });
  }, [
    aaveV3CollateralReservePosition.aTokenAssets,
    aaveV3CollateralReservePosition.reserve.aToken.decimals,
    aaveV3LoanReservePosition.borrowAssets,
    aaveV3LoanReservePosition.reserve.underlyingAsset.decimals,
  ]);

  const defaultValues = useMemo(() => {
    return {
      collateralMigrateAmount: formatUnits(
        BigInt(aaveV3CollateralReservePosition.aTokenAssets),
        aaveV3CollateralReservePosition.reserve.aToken.decimals
      ),
      isMaxCollateral: true,
      loanMigrateAmount: formatUnits(
        BigInt(aaveV3LoanReservePosition.borrowAssets),
        aaveV3LoanReservePosition.reserve.underlyingAsset.decimals
      ),
      isMaxLoan: true,
    };
  }, [
    aaveV3CollateralReservePosition.aTokenAssets,
    aaveV3CollateralReservePosition.reserve.aToken.decimals,
    aaveV3LoanReservePosition.borrowAssets,
    aaveV3LoanReservePosition.reserve.underlyingAsset.decimals,
  ]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues,
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
        : parseUnits(collateralMigrateAmount, aaveV3CollateralReservePosition.reserve.aToken.decimals);

      const rawLoanMigrateAmount = isMaxLoan
        ? maxUint256
        : parseUnits(loanMigrateAmount, aaveV3LoanReservePosition.reserve.underlyingAsset.decimals);

      const preparedAction = await aaveV3MarketMigrationAction({
        publicClient,
        accountAddress: address,
        marketId: destinationMarketSummary.marketId as MarketId,
        collateralTokenAmount: rawCollateralMigrateAmount,
        loanTokenAmount: rawLoanMigrateAmount,
        allocatingVaultAddresses: destinationMarketSummary.vaultAllocations.map((allocation) =>
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
      destinationMarketSummary,
      aaveV3CollateralReservePosition,
      aaveV3LoanReservePosition,
      onOpenChange,
    ]
  );

  // Reset form on new vaultReservePositionPairing
  useEffect(() => {
    form.reset(defaultValues);
  }, [
    destinationMarketPosition,
    aaveV3CollateralReservePosition,
    aaveV3LoanReservePosition,
    collateralBalance,
    loanBalance,
    form,
    defaultValues,
  ]);

  const rawCollateralMigrateAmount = useWatchParseUnits({
    control: form.control,
    name: "collateralMigrateAmount",
    decimals: aaveV3CollateralReservePosition.reserve.aToken.decimals,
  });
  const rawLoanMigrateAmount = useWatchParseUnits({
    control: form.control,
    name: "loanMigrateAmount",
    decimals: aaveV3LoanReservePosition.reserve.underlyingAsset.decimals,
  });

  const { collateralMigrateAmountUsd, loanMigrateAmountUsd } = useMemo(() => {
    return {
      collateralMigrateAmountUsd: calculateUsdValue(
        rawCollateralMigrateAmount,
        aaveV3CollateralReservePosition.reserve.aToken.decimals,
        aaveV3CollateralReservePosition.reserve.underlyingAsset.priceUsd
      ),
      loanMigrateAmountUsd: calculateUsdValue(
        rawLoanMigrateAmount,
        aaveV3LoanReservePosition.reserve.underlyingAsset.decimals,
        aaveV3LoanReservePosition.reserve.underlyingAsset.priceUsd
      ),
    };
  }, [
    aaveV3CollateralReservePosition.reserve.aToken.decimals,
    aaveV3CollateralReservePosition.reserve.underlyingAsset.priceUsd,
    aaveV3LoanReservePosition.reserve.underlyingAsset.decimals,
    aaveV3LoanReservePosition.reserve.underlyingAsset.priceUsd,
    rawCollateralMigrateAmount,
    rawLoanMigrateAmount,
  ]);

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
        finalValue={<Apy type="borrow" apy={destinationMarketSummary.borrowApy} />}
      />
    );
  }, [
    collateralMigrateAmountUsd,
    aaveV3CollateralReservePosition,
    loanMigrateAmountUsd,
    aaveV3LoanReservePosition,
    destinationMarketSummary,
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
        morphoLtvHealth: computeLtvHealth(simulatedMarketPositionLtv, destinationMarketSummary.lltv),
      };
    }, [
      aaveFullPositionMetrics,
      loanMigrateAmountUsd,
      collateralMigrateAmountUsd,
      destinationMarketPosition,
      aaveV3CollateralReservePosition,
      destinationMarketSummary,
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
                            rawAvailableBalance={BigInt(aaveV3CollateralReservePosition.aTokenAssets)}
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
                              rawAvailableBalance={BigInt(aaveV3LoanReservePosition.borrowAssets)}
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
                      <MarketIdentifier {...destinationMarketSummary} />
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
                            rawAmount={rawCollateralMigrateAmount}
                          />
                          <div className="h-[1px] w-full bg-border-primary" />
                          <div className="[&_label]:text-accent-ternary">
                            <AssetFormFieldViewOnly
                              actionName="Borrow"
                              asset={loanAsset}
                              rawAmount={rawLoanMigrateAmount}
                            />
                          </div>
                        </div>
                        <div className="px-6 py-4">
                          <LtvBar ltv={simulatedMarketPositionLtv} lltv={destinationMarketSummary.lltv} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-[1px] w-full bg-border-primary" />

                  <div className="flex flex-col gap-5">{netApyMetricChange}</div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Button
                      type="submit"
                      className="w-full"
                      variant="borrow"
                      disabled={
                        simulatingBundle ||
                        !form.formState.isValid ||
                        aaveLtvHealth == "unhealthy" ||
                        morphoLtvHealth == "unhealthy"
                      }
                      isLoading={simulatingBundle}
                      loadingMessage="Simulating"
                    >
                      {rawCollateralMigrateAmount == 0n && rawLoanMigrateAmount == 0n
                        ? "Enter Amount"
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
              asset={destinationMarketSummary.loanAsset}
              actionName="Migrate"
              side="borrow"
              isIncreasing={true}
              rawAmount={rawLoanMigrateAmount}
              protocolName="Compound Blue"
            />
            <ActionFlowSummaryAssetItem
              asset={destinationMarketSummary.collateralAsset!}
              actionName="Borrow"
              side="supply"
              isIncreasing={true}
              rawAmount={rawCollateralMigrateAmount}
              protocolName="Compound Blue"
            />
          </ActionFlowSummary>
          <ActionFlowReview>
            <MetricChange
              name={`Collateral (${destinationMarketSummary.collateralAsset!.symbol})`}
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
              name={`Loan (${destinationMarketSummary.loanAsset.symbol})`}
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
                ) / {formatNumber(destinationMarketSummary.lltv, { style: "percent" })}
              </div>
            </div>
          </ActionFlowReview>
          <ActionFlowButton>Migrate</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
