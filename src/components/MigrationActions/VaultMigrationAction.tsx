"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowDown } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { getAddress, maxUint256, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { usePublicClient } from "wagmi";
import { z } from "zod";

import { aaveV3VaultMigrationAction } from "@/actions/migration/aaveV3VaultMigrationAction";
import { Action } from "@/actions/utils/types";
import AssetFormField, { AssetFormFieldViewOnly } from "@/components/FormFields/AssetFormField";
import { Form } from "@/components/ui/form";
import { VaultMigrationTableEntry } from "@/hooks/useVaultMigrationTableData";
import { descaleBigIntToNumber, numberToString } from "@/utils/format";

import { ActionFlowButton, ActionFlowReview, ActionFlowSummary, ActionFlowSummaryAssetItem } from "../ActionFlowDialog";
import { ActionFlowDialog } from "../ActionFlowDialog";
import Apy from "../Apy";
import { MetricChange } from "../MetricChange";
import { Button } from "../ui/button";
import { DialogDrawer, DialogDrawerContent, DialogDrawerTitle } from "../ui/dialogDrawer";
import NumberFlow from "../ui/NumberFlow";
import { VaultIdentifier } from "../VaultIdentifier";

interface VaultMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: VaultMigrationTableEntry;
}

export default function VaultMigrationAction({
  open,
  onOpenChange,
  data: { sourcePosition, destinationPosition, destinationVaultSummary },
}: VaultMigrationDialogProps) {
  const [simulatingBundle, setSimulatingBundle] = useState(false);
  const [txFlowOpen, setTxFlowOpen] = useState(false);
  const [preparedAction, setPreparedAction] = useState<Action | undefined>(undefined);

  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const descaledATokenBalance = useMemo(() => {
    return descaleBigIntToNumber(sourcePosition.aTokenAssets, sourcePosition.reserve.aToken.decimals);
  }, [sourcePosition]);

  const aTokenBalanceUsd = sourcePosition.aTokenAssetsUsd;
  const vaultPositionBalanceUsd = destinationPosition.supplyAssetsUsd ?? 0;

  const formSchema = useMemo(() => {
    return z.object({
      migrateAmount: z.coerce
        .string()
        .nonempty("Amount is required")
        .refine((val) => Number(val) <= descaledATokenBalance, "Amount exceeds wallet balance.")
        .refine((val) => Number(val) > 0, "Amount must be greater than 0.")
        .transform((val) => Number(val)),
      isMaxMigrate: z.boolean(),
    });
  }, [descaledATokenBalance]);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      migrateAmount: descaledATokenBalance,
      isMaxMigrate: true,
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
      const { migrateAmount, isMaxMigrate } = values;

      const migrateAmountBigInt = isMaxMigrate
        ? maxUint256
        : parseUnits(numberToString(migrateAmount), sourcePosition.reserve.aToken.decimals);

      const preparedAction = await aaveV3VaultMigrationAction({
        publicClient,
        accountAddress: address,
        vaultAddress: getAddress(destinationVaultSummary.vaultAddress),
        amount: migrateAmountBigInt,
      });

      setPreparedAction(preparedAction);

      if (preparedAction.status === "success") {
        onOpenChange(false);
        setTxFlowOpen(true);
      }

      setSimulatingBundle(false);
    },
    [address, openConnectModal, publicClient, sourcePosition, onOpenChange, destinationVaultSummary]
  );

  // Reset form on new vaultReservePositionPairing
  useEffect(() => {
    form.reset({
      migrateAmount: descaledATokenBalance,
      isMaxMigrate: true,
    });
  }, [destinationPosition, sourcePosition, descaledATokenBalance, form]);

  const migrateAmount = Number(form.watch("migrateAmount") ?? 0);
  const migrateAmountUsd = migrateAmount * (sourcePosition.reserve.underlyingAsset.priceUsd ?? 0);

  const simContent = useMemo(() => {
    return (
      <>
        <MetricChange
          name={`Aave v3 (${destinationVaultSummary.asset.symbol})`}
          initialValue={<NumberFlow value={aTokenBalanceUsd} format={{ currency: "USD" }} />}
          finalValue={
            <NumberFlow
              value={Math.max(migrateAmount == descaledATokenBalance ? 0 : aTokenBalanceUsd - migrateAmountUsd, 0)}
              format={{ currency: "USD" }}
            />
          }
        />
        <MetricChange
          name={`Compound (${destinationVaultSummary.asset.symbol})`}
          initialValue={<NumberFlow value={vaultPositionBalanceUsd} format={{ currency: "USD" }} />}
          finalValue={<NumberFlow value={vaultPositionBalanceUsd + migrateAmountUsd} format={{ currency: "USD" }} />}
        />
        <MetricChange
          name="Net APY"
          initialValue={<NumberFlow value={sourcePosition.reserve.supplyApy.total} format={{ style: "percent" }} />}
          finalValue={<Apy type="supply" apy={destinationVaultSummary.supplyApy} />}
        />
      </>
    );
  }, [
    aTokenBalanceUsd,
    migrateAmount,
    migrateAmountUsd,
    vaultPositionBalanceUsd,
    sourcePosition,
    descaledATokenBalance,
    destinationVaultSummary,
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
                          asset={sourcePosition.reserve.underlyingAsset}
                          descaledAvailableBalance={descaledATokenBalance}
                          setIsMax={(isMax) => {
                            form.setValue("isMaxMigrate", isMax);
                          }}
                        />
                      </div>
                    </div>

                    <ArrowDown size={16} className="stroke-content-primary md:mt-[56px] md:-rotate-90" />

                    <div className="flex w-full flex-1 flex-col gap-4">
                      <VaultIdentifier
                        name={destinationVaultSummary.name}
                        metadata={destinationVaultSummary.metadata}
                        asset={destinationVaultSummary.asset}
                      />
                      <div className="rounded-[12px] bg-background-secondary p-6">
                        <AssetFormFieldViewOnly
                          actionName="Supply"
                          asset={sourcePosition.reserve.underlyingAsset}
                          amount={migrateAmount}
                          amountUsd={migrateAmountUsd}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="h-[1px] w-full bg-border-primary" />

                  <div className="flex flex-col gap-5">{simContent}</div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={simulatingBundle || !form.formState.isValid}
                      isLoading={simulatingBundle}
                      loadingMessage="Simulating"
                    >
                      {migrateAmount == 0 ? "Enter Amount" : "Review Migration"}
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
              asset={destinationVaultSummary.asset}
              actionName="Remove"
              side="supply"
              isIncreasing={false}
              descaledAmount={migrateAmount}
              amountUsd={migrateAmountUsd}
              protocolName="Aave v3"
            />
            <ActionFlowSummaryAssetItem
              asset={destinationVaultSummary.asset}
              actionName="Supply"
              side="supply"
              isIncreasing={true}
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
