"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { MarketId } from "@morpho-org/blue-sdk";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useDebounce } from "use-debounce";
import { getAddress, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { z } from "zod";

import {
  AaveV3PortfolioMigrationToMarketAction,
  aaveV3PortfolioMigrationToMarketAction,
} from "@/actions/migration/aaveV3PortfolioMigrationToMarketAction";
import {
  AaveV3PortfolioMigrationToVaultAction,
  aaveV3PortfolioMigrationToVaultAction,
} from "@/actions/migration/aaveV3PortfolioMigrationToVaultAction";
import { Form } from "@/components/ui/form";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import {
  SupportedProtocolsForProtocolMigration,
  useProtocoMigratorTableDataEntry,
} from "@/hooks/useProtocolMigratorTableData";
import { useWatchNumberField } from "@/hooks/useWatchNumberField";
import { numberToString } from "@/utils/format";

import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { DialogDrawer } from "../ui/dialogDrawer";
import Wallet from "../ui/icons/Wallet";

import { ProtocolMigratorMarketActionFlow } from "./ProtocolMigratorMarketActionFlow";
import { ProtocolMigratorMarketDestination } from "./ProtocolMigratorMarketDestination";
import ProtocolMigratorSourceCardContent from "./ProtocolMigratorSourceCardContent";
import { ProtocolMigratorVaultActionFlow } from "./ProtocolMigratorVaultActionFlow";
import { ProtocolMigratorVaultDestination } from "./ProtocolMigratorVaultDestination";
import {
  ProtocolMigratorVaultMarketSelectContent,
  ProtocolMigratorVaultMarketSelectTrigger,
  ProtocolMigratorVaultMarketSelection,
} from "./ProtocolMigratorVaultMarketSelect";

const baseFields = {
  portfolioPercent: z.coerce.number().min(0).max(100),
  maxSlippageTolerancePercent: z.coerce.number().min(0).max(100),
};

const protocolMigratorFormSchema = z.discriminatedUnion("destinationType", [
  z.object({
    ...baseFields,
    destinationType: z.literal("vault"),
    borrowAmount: z.coerce.number().optional(),
  }),
  z.object({
    ...baseFields,
    destinationType: z.literal("market"),
    borrowAmount: z
      .string({ required_error: "Amount is required" })
      .nonempty("Amount is required.")
      .pipe(z.coerce.number().positive("Amount must be greater than zero.")),
  }),
]);

export type ProtocolMigratorFormValues = z.infer<typeof protocolMigratorFormSchema>;

interface ProtocolMigratorControllerProps {
  marketSummaries: MarketSummary[];
  vaultSummaries: VaultSummary[];
  protocolKey: SupportedProtocolsForProtocolMigration;
}

export default function ProtocolMigratorController({
  protocolKey,
  vaultSummaries,
  marketSummaries,
}: ProtocolMigratorControllerProps) {
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [destinationSelection, setDestinationSelection] = useState<ProtocolMigratorVaultMarketSelection | null>(null);
  const [destinationSelectOpen, setDestinationSelectOpen] = useState(false);
  const { data: protocolEntry } = useProtocoMigratorTableDataEntry(protocolKey);
  const publicClient = usePublicClient();
  const [simulating, setSimulating] = useState(false);

  const [vaultActionFlowOpen, setVaultActionFlowOpen] = useState(false);
  const [preparedVaultDestinationAction, setPreparedVaultDestinationAction] = useState<
    AaveV3PortfolioMigrationToVaultAction | undefined
  >(undefined);

  const [marketActionFlowOpen, setMarketActionFlowOpen] = useState(false);
  const [preparedMarketDestinationAction, setPreparedMarketDestinationAction] = useState<
    AaveV3PortfolioMigrationToMarketAction | undefined
  >(undefined);

  const form = useForm<ProtocolMigratorFormValues>({
    mode: "onChange",
    resolver: zodResolver(protocolMigratorFormSchema),
    defaultValues: {
      portfolioPercent: 100,
      borrowAmount: undefined,
      maxSlippageTolerancePercent: 1.5,
    },
  });

  const portfolioPercent = useWatchNumberField({ control: form.control, name: "portfolioPercent" });
  const [portfolioPercentDebounced] = useDebounce(portfolioPercent, 200);
  const migrateValueUsd = useMemo(() => {
    if (!protocolEntry) {
      return 0;
    } else {
      return protocolEntry.totalMigratableValueUsd * (portfolioPercentDebounced / 100);
    }
  }, [protocolEntry, portfolioPercentDebounced]);

  const onSubmit = async (data: ProtocolMigratorFormValues) => {
    if (!address) {
      openConnectModal?.();
      return;
    }

    if (!publicClient) {
      // Should never get here...
      throw new Error("Missing pulic client");
    }

    if (!destinationSelection) {
      // Should not be possible to submit in this case
      return;
    }

    setSimulating(true);

    if (destinationSelection.type == "vault") {
      const action = await aaveV3PortfolioMigrationToVaultAction({
        publicClient,
        accountAddress: address,
        portfolioPercentage: portfolioPercentDebounced / 100,
        maxSlippageTolerance: data.maxSlippageTolerancePercent / 100,
        vaultAddress: getAddress(destinationSelection.vault.vaultAddress),
      });

      setPreparedVaultDestinationAction(action);

      if (action.status == "success") {
        setVaultActionFlowOpen(true);
      }
    } else {
      if (!data.borrowAmount) {
        console.log("borrow amount is required");
        form.setError("borrowAmount", {
          message: "Borrow amount is required",
        });
      } else {
        const rawBorrowAmount = parseUnits(
          numberToString(data.borrowAmount),
          destinationSelection.market.loanAsset.decimals
        );
        const action = await aaveV3PortfolioMigrationToMarketAction({
          publicClient,
          accountAddress: address,
          portfolioPercentage: portfolioPercentDebounced / 100,
          maxSlippageTolerance: data.maxSlippageTolerancePercent / 100,
          marketId: destinationSelection.market.marketId as MarketId,
          borrowAmount: rawBorrowAmount,
          allocatingVaultAddresses: destinationSelection.market.vaultAllocations.map((v) =>
            getAddress(v.vault.vaultAddress)
          ),
        });

        setPreparedMarketDestinationAction(action);

        if (action.status == "success") {
          setMarketActionFlowOpen(true);
        }
      }
    }

    setSimulating(false);
  };

  // Bind selection to form field for validation
  useEffect(() => {
    if (destinationSelection?.type == "vault") {
      form.setValue("destinationType", "vault", { shouldValidate: true, shouldDirty: true });
    } else if (destinationSelection?.type == "market") {
      form.setValue("destinationType", "market", { shouldValidate: true, shouldDirty: true });
    }
  }, [destinationSelection?.type, form]);

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset
            disabled={simulating || vaultActionFlowOpen || marketActionFlowOpen}
            style={{ all: "unset", width: "100%" }}
          >
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-5 md:flex-row">
                <Step number="1" title="Migration Amount" description="Select how much of your portfolio to migrate." />
                <div className="flex w-full max-w-[400px] flex-col gap-6">
                  <Card className="w-full max-w-[400px]">
                    {address ? (
                      <ProtocolMigratorSourceCardContent
                        protocolKey={protocolKey}
                        control={form.control}
                        name="portfolioPercent"
                        migrateValueUsd={migrateValueUsd}
                      />
                    ) : (
                      <CardContent className="flex h-full w-full flex-col items-center justify-center gap-4">
                        <Wallet className="h-12 w-12 fill-content-secondary" />
                        <div className="text-content-secondary label-lg">Connect wallet to begin migration.</div>
                        <Button onClick={openConnectModal}>Connect Wallet</Button>
                      </CardContent>
                    )}
                  </Card>
                  <div className="hidden w-full items-center justify-center md:flex">
                    <ArrowDown />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-5 md:flex-row">
                <Step
                  number="2"
                  title="Destination"
                  description="Select the destination vault or market for your assets on Compound Blue."
                />
                <div className="flex w-full max-w-[400px] flex-col gap-6">
                  <Card className="overflow-hidden">
                    <DialogDrawer open={destinationSelectOpen} onOpenChange={setDestinationSelectOpen}>
                      {destinationSelection?.type == "vault" ? (
                        <ProtocolMigratorVaultDestination
                          vault={destinationSelection.vault}
                          migrateValueUsd={migrateValueUsd}
                          openChange={() => setDestinationSelectOpen(true)}
                        />
                      ) : destinationSelection?.type == "market" ? (
                        <ProtocolMigratorMarketDestination
                          market={destinationSelection.market}
                          migrateValueUsd={migrateValueUsd}
                          openChange={() => setDestinationSelectOpen(true)}
                        />
                      ) : (
                        <ProtocolMigratorVaultMarketSelectTrigger />
                      )}

                      <ProtocolMigratorVaultMarketSelectContent
                        vaultSummaries={vaultSummaries}
                        marketSummaries={marketSummaries}
                        onSelect={setDestinationSelection}
                        close={() => setDestinationSelectOpen(false)}
                      />
                    </DialogDrawer>
                  </Card>
                  <div className="flex min-w-0 flex-col gap-2">
                    <Button
                      type="submit"
                      className="w-full"
                      variant={destinationSelection?.type == "market" ? "borrow" : "primary"}
                      isLoading={simulating}
                      disabled={simulating || !form.formState.isValid}
                      loadingMessage="Simulating"
                    >
                      Review Migration
                    </Button>

                    {destinationSelection?.type == "market" && preparedMarketDestinationAction?.status == "error" && (
                      <p className="max-h-[50px] overflow-y-auto text-semantic-negative paragraph-sm">
                        {preparedMarketDestinationAction.message}
                      </p>
                    )}

                    {destinationSelection?.type == "vault" && preparedVaultDestinationAction?.status == "error" && (
                      <p className="max-h-[50px] overflow-y-auto text-semantic-negative paragraph-sm">
                        {preparedVaultDestinationAction.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </fieldset>
        </form>
      </Form>

      <ProtocolMigratorVaultActionFlow
        open={vaultActionFlowOpen}
        onOpenChange={setVaultActionFlowOpen}
        action={preparedVaultDestinationAction}
        vault={destinationSelection?.type == "vault" ? destinationSelection.vault : undefined}
      />

      <ProtocolMigratorMarketActionFlow
        action={preparedMarketDestinationAction}
        open={marketActionFlowOpen}
        onOpenChange={setMarketActionFlowOpen}
        market={destinationSelection?.type == "market" ? destinationSelection.market : undefined}
      />
    </>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background-secondary">{number}</div>
      <div className="flex w-full flex-col gap-4 md:w-[280px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-content-secondary label-md">Step {number}</span>
          <h2 className="title-5">{title}</h2>
        </div>
        <p className="text-content-secondary paragraph-lg">{description}</p>
      </div>
    </div>
  );
}
