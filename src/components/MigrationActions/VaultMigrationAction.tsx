"use client";
import { DialogDrawer, DialogDrawerContent, DialogDrawerTitle } from "../ui/dialogDrawer";
import { Button } from "../ui/button";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { descaleBigIntToNumber, numberToString } from "@/utils/format";
import { zodResolver } from "@hookform/resolvers/zod";
import AssetFormField from "../AssetFormField";
import { useAccount } from "wagmi";
import { usePublicClient } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAddress, maxUint256, parseUnits } from "viem";
import { prepareVaultMigrationBundle } from "@/actions/prepareAaveV3VaultMigrationAction";
import { PrepareActionReturnType } from "@/actions/helpers";
import { ActionFlowButton, ActionFlowReview, ActionFlowSummary, ActionFlowSummaryAssetItem } from "../ActionFlowDialog";
import { ActionFlowDialog } from "../ActionFlowDialog";
import { ArrowDown } from "lucide-react";
import NumberFlow from "../ui/NumberFlow";
import Image from "next/image";
import { MetricChange } from "../MetricChange";
import Apy from "../Apy";
import { MigratableAaveV3SupplyPosition } from "@/hooks/useMigratableAaveV3SupplyPosition";
import { VaultIdentifier } from "../VaultIdentifier";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";

interface VaultMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  migratableAaveV3SupplyPosition: MigratableAaveV3SupplyPosition;
  vault: VaultSummary;
}

export default function VaultMigrationAction({
  open,
  onOpenChange,
  migratableAaveV3SupplyPosition: { aaveV3ReservePosition, destinationVaultPosition },
  vault,
}: VaultMigrationDialogProps) {
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [txFlowOpen, setTxFlowOpen] = useState(false);
  const [preparedAction, setPreparedAction] = useState<PrepareActionReturnType | undefined>(undefined);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const descaledATokenBalance = useMemo(() => {
    return descaleBigIntToNumber(aaveV3ReservePosition.aTokenAssets, aaveV3ReservePosition.reserve.aToken.decimals);
  }, [aaveV3ReservePosition]);

  const aTokenBalanceUsd = aaveV3ReservePosition.aTokenAssetsUsd;
  const vaultPositionBalanceUsd = destinationVaultPosition.supplyAssetsUsd;

  const formSchema = useMemo(() => {
    return z.object({
      migrateAmount: z.coerce
        .string()
        .nonempty("Amount is required")
        .refine((val) => Number(val) <= descaledATokenBalance, "Amount exceeds wallet balance.")
        .transform((val) => Number(val)),
    });
  }, [descaledATokenBalance]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      migrateAmount: descaledATokenBalance,
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
      const { migrateAmount } = values;
      const migrateAmountBigInt =
        migrateAmount === descaledATokenBalance
          ? maxUint256
          : parseUnits(numberToString(migrateAmount), aaveV3ReservePosition.reserve.aToken.decimals);

      const preparedAction = await prepareVaultMigrationBundle({
        publicClient,
        accountAddress: address,
        vaultAddress: getAddress(destinationVaultPosition.vaultAddress),
        aTokenAddress: getAddress(aaveV3ReservePosition.reserve.aToken.address),
        aTokenAmount: migrateAmountBigInt,
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
      destinationVaultPosition,
      aaveV3ReservePosition,
      descaledATokenBalance,
      onOpenChange,
    ]
  );

  // Reset form on new vaultReservePositionPairing
  useEffect(() => {
    form.reset({
      migrateAmount: descaledATokenBalance,
    });
  }, [destinationVaultPosition, aaveV3ReservePosition, descaledATokenBalance, form]);

  const migrateAmount = Number(form.watch("migrateAmount") ?? 0);
  const migrateAmountUsd = migrateAmount * aaveV3ReservePosition.reserve.underlyingAsset.priceUsd;

  const simContent = useMemo(() => {
    return (
      <>
        <MetricChange
          name={`Aave v3 (${destinationVaultPosition.asset.symbol})`}
          initialValue={<NumberFlow value={aTokenBalanceUsd} format={{ currency: "USD" }} />}
          finalValue={
            <NumberFlow
              value={Math.max(migrateAmount == descaledATokenBalance ? 0 : aTokenBalanceUsd - migrateAmountUsd, 0)}
              format={{ currency: "USD" }}
            />
          }
        />
        <MetricChange
          name={`Compound (${destinationVaultPosition.asset.symbol})`}
          initialValue={<NumberFlow value={vaultPositionBalanceUsd} format={{ currency: "USD" }} />}
          finalValue={<NumberFlow value={vaultPositionBalanceUsd + migrateAmountUsd} format={{ currency: "USD" }} />}
        />
        <MetricChange
          name="Net APY"
          initialValue={
            <NumberFlow value={aaveV3ReservePosition.reserve.supplyApy.total} format={{ style: "percent" }} />
          }
          finalValue={<Apy type="supply" apy={destinationVaultPosition.supplyApy} />}
        />
      </>
    );
  }, [
    aTokenBalanceUsd,
    migrateAmount,
    migrateAmountUsd,
    vaultPositionBalanceUsd,
    aaveV3ReservePosition,
    destinationVaultPosition,
    descaledATokenBalance,
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
                      <div className="rounded-[12px] bg-background-secondary p-6">
                        <AssetFormField
                          control={form.control}
                          name="migrateAmount"
                          actionName="Remove"
                          asset={aaveV3ReservePosition.reserve.underlyingAsset}
                          descaledAvailableBalance={descaledATokenBalance}
                        />
                      </div>
                    </div>

                    <ArrowDown size={16} className="stroke-content-primary md:mt-[56px] md:-rotate-90" />

                    <div className="flex w-full flex-1 flex-col gap-4">
                      <VaultIdentifier name={vault.name} metadata={vault.metadata} asset={vault.asset} />
                      <div className="flex flex-col gap-2 rounded-[12px] bg-background-secondary p-6">
                        <span className="text-accent-secondary label-sm">
                          Supply {aaveV3ReservePosition.reserve.underlyingAsset.symbol}
                        </span>
                        <div className="flex flex-col">
                          <NumberFlow
                            value={migrateAmount}
                            className="!font-medium title-2"
                            format={{ maximumFractionDigits: 6 }}
                          />
                          <NumberFlow
                            value={migrateAmountUsd}
                            format={{ currency: "USD" }}
                            className="text-content-secondary label-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-[1px] w-full bg-border-primary" />

                  <div className="flex flex-col gap-5">{simContent}</div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Button type="submit" className="w-full" disabled={simulatingBundle || !form.formState.isValid}>
                      {migrateAmount == 0 ? "Enter Amount" : simulatingBundle ? "Simulating..." : "Review Migration"}
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
              asset={destinationVaultPosition.asset}
              actionName="Remove"
              descaledAmount={migrateAmount}
              amountUsd={migrateAmountUsd}
              protocolName="Aave v3"
            />
            <ActionFlowSummaryAssetItem
              asset={destinationVaultPosition.asset}
              actionName="Supply"
              descaledAmount={migrateAmount}
              amountUsd={migrateAmountUsd}
              protocolName="Compound Blue"
            />
          </ActionFlowSummary>
          <ActionFlowReview>{simContent}</ActionFlowReview>
          <ActionFlowButton>Migrate</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}
