"use client";
import { SupportedProtocolsForProtocolMigration } from "@/hooks/useProtocolMigratorTableData";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import ProtocolMigratorSourceCardContent from "./ProtocolMigratorSourceCardContent";
import { Card, CardContent } from "../ui/card";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "../ui/button";
import Wallet from "../ui/icons/Wallet";
import { z } from "zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import ProtocolMigratorVaultMarketSelect from "./ProtocolMigratorVaultMarketSelect";

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

  const formSchema = useMemo(() => {
    return z.object({
      portfolioPercent: z.coerce.number().min(0).max(100),
    });
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
    defaultValues: {
      portfolioPercent: 100,
      //   borrowAmount: z.string().optional().pipe(z.coerce.number().nonnegative().optional()),
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);
  };

  // State
  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={false} style={{ all: "unset", width: "100%" }}>
            <div className="flex flex-col gap-8">
              <div className="flex gap-5">
                <Step
                  number="1"
                  title="Migration Details"
                  description="Review the assets you're currently supplying and borrowing. This will migrate all the assets in Aave v3."
                />
                <Card className="w-[400px]">
                  {address ? (
                    <ProtocolMigratorSourceCardContent
                      protocolKey={protocolKey}
                      control={form.control}
                      name="portfolioPercent"
                    />
                  ) : (
                    <CardContent className="flex h-full w-full flex-col items-center justify-center gap-4">
                      <Wallet className="h-12 w-12 fill-content-secondary" />
                      <div className="text-content-secondary label-lg">Connect wallet to begin migration.</div>
                      <Button onClick={openConnectModal}>Connect Wallet</Button>
                    </CardContent>
                  )}
                </Card>
              </div>

              <div className="flex gap-5">
                <Step
                  number="2"
                  title="Destination"
                  description="Select the destination vault or market for your assets on Compound Blue."
                />
                <Card className="w-[400px] overflow-hidden">
                  <ProtocolMigratorVaultMarketSelect
                    vaultSummaries={vaultSummaries}
                    marketSummaries={marketSummaries}
                    onSelect={() => {}}
                  />
                  {/* TODO */}
                  {/* <ProtocolMigratorPercentSelectCard /> */}
                </Card>
              </div>
            </div>
          </fieldset>
        </form>
      </Form>
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
