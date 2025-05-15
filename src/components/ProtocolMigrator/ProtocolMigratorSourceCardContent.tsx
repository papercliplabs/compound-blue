"use client";
import clsx from "clsx";
import { ChevronDown, Info } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";

import { AaveV3ReservePosition } from "@/data/whisk/getAaveV3MarketPosition";
import { useAaveV3MarketPosition } from "@/hooks/useAaveV3MarketPosition";
import {
  SupportedProtocolsForProtocolMigration,
  useProtocoMigratorTableDataEntry,
} from "@/hooks/useProtocolMigratorTableData";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";

import { NumberInputFormField } from "../FormFields/NumberInputFormField";
import SliderFormField from "../FormFields/SliderFormField";
import LinkExternal from "../LinkExternal";
import { MetricChange } from "../MetricChange";
import { CardContent, CardHeader } from "../ui/card";
import PoweredByMorpho from "../ui/icons/PoweredByMorpho";
import NumberFlow, { NumberFlowWithLoading } from "../ui/NumberFlow";
import { Skeleton } from "../ui/skeleton";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../ui/tooltipPopover";

import { ProtocolMigratorFormValues } from "./ProtocolMigratorController";
import ProtocolMigratorHowItWorks from "./ProtocolMigratorHowItWorks";

interface ProtocolMigratorSourceCardContentProps {
  protocolKey: SupportedProtocolsForProtocolMigration;
  supplyMigrateValueUsd: number;
  borrowMigrateValueUsd: number;
  totalMigrateValueUsd: number;
}

// Assume account is connected (handle in parent)

export default function ProtocolMigratorSourceCardContent({
  protocolKey,
  supplyMigrateValueUsd,
  borrowMigrateValueUsd,
  totalMigrateValueUsd,
}: ProtocolMigratorSourceCardContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: protocolEntry, isLoading } = useProtocoMigratorTableDataEntry(protocolKey);
  const { data: position } = useAaveV3MarketPosition();

  const { supplyingPositions, borrowingPositions } = useMemo(() => {
    if (!position) {
      return { supplyingPositions: [], borrowingPositions: [] };
    }

    const supplyingPositions = position.reservePositions.filter((position) => BigInt(position.aTokenAssets) > 0n);

    const borrowingPositions = position.reservePositions.filter((position) => BigInt(position.borrowAssets) > 0n);

    return { supplyingPositions, borrowingPositions };
  }, [position]);

  const form = useFormContext<ProtocolMigratorFormValues>();

  return (
    <>
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full" type="button">
        <CardHeader className="h-fit px-6 py-4 text-content-primary">
          <div className="flex gap-4">
            <Image src="/aave.png" alt="Aave" width={40} height={40} className="rounded-[8px]" />

            <div className="flex h-full flex-col items-start justify-between">
              <h3 className="title-5">Aave v3</h3>
              <span className="text-content-secondary">Protocol</span>
            </div>
          </div>

          <div className="-mr-2 flex items-center gap-1">
            <div className="flex flex-col items-end">
              <NumberFlowWithLoading
                value={protocolEntry?.totalMigratableValueUsd}
                format={{ currency: "USD" }}
                isLoading={isLoading}
                loadingContent={<Skeleton className="h-[24px] w-[70px]" />}
                className="h-[24px] label-lg"
              />
              <span className="text-content-secondary paragraph-sm">Available to Migrate</span>
            </div>
            <ChevronDown className={clsx("transition-transform duration-300", isExpanded && "-rotate-180")} />
          </div>
        </CardHeader>
      </button>

      <motion.div
        initial={{ height: "0px" }}
        animate={{ height: isExpanded ? "auto" : "0px" }}
        className="w-full overflow-hidden bg-background-inverse"
      >
        <div className="flex flex-col gap-6 px-6 pb-6 pt-4">
          <div>
            <span className="text-accent-secondary label-lg">Supplying</span>
            <div className="flex flex-col gap-2 pt-4">
              {supplyingPositions.map((position, i) => (
                <ReservePositionRow key={i} reservePosition={position} type="supplying" />
              ))}
            </div>
            {supplyingPositions.length === 0 && <div className="text-content-secondary">None</div>}
          </div>

          <div>
            <span className="text-accent-ternary label-lg">Borrowing</span>
            <div className="flex flex-col gap-2 pt-4">
              {borrowingPositions.map((position, i) => (
                <ReservePositionRow key={i} reservePosition={position} type="borrowing" />
              ))}
            </div>
            {borrowingPositions.length === 0 && <div className="text-content-secondary">None</div>}
          </div>

          <div className="h-[1px] w-full bg-border-primary" />

          <div className="flex items-center justify-between">
            <span className="label-lg">Total Migratable</span>
            <span className="paragraph-lg">
              {formatNumber(protocolEntry?.totalMigratableValueUsd ?? 0, { currency: "USD" })}
            </span>
          </div>
        </div>
      </motion.div>

      <CardContent className="flex flex-col gap-6 px-6 pt-4">
        <div>
          <SliderFormField
            control={form.control}
            name="portfolioPercent"
            includeInput={false}
            labelContent={
              <div className="flex w-full justify-between">
                <TooltipPopover>
                  <TooltipPopoverTrigger className="flex items-center gap-1">
                    Select amount to migrate
                    <Info size={14} />
                  </TooltipPopoverTrigger>
                  <TooltipPopoverContent className="flex flex-col gap-2">
                    <p>The percentage of your Aave v3 supply and loan positions to migrate.</p>
                  </TooltipPopoverContent>
                </TooltipPopover>

                <NumberFlow
                  value={totalMigrateValueUsd}
                  format={{ currency: "USD" }}
                  className="h-[36px] text-content-primary label-lg"
                />
              </div>
            }
            sliderMin={0}
            sliderMax={100}
            sliderStep={0.1}
            unit="%"
            supply
          />
        </div>

        <div className="h-[1px] w-full bg-border-primary" />

        <div className="flex flex-col gap-4">
          <MetricChange
            name={
              <TooltipPopover>
                <TooltipPopoverTrigger className="flex items-center gap-1">
                  Supplied
                  <Info size={14} className="text-content-secondary" />
                </TooltipPopoverTrigger>
                <TooltipPopoverContent className="flex flex-col gap-2">
                  The sum of all your supplied assets in Aave v3.
                </TooltipPopoverContent>
              </TooltipPopover>
            }
            initialValue={<NumberFlow value={protocolEntry?.totalSupplyValueUsd ?? 0} format={{ currency: "USD" }} />}
            finalValue={
              <NumberFlow
                value={Math.max((protocolEntry?.totalSupplyValueUsd ?? 0) - supplyMigrateValueUsd, 0)}
                format={{ currency: "USD" }}
              />
            }
          />
          <MetricChange
            name={
              <TooltipPopover>
                <TooltipPopoverTrigger className="flex items-center gap-1">
                  Borrowed
                  <Info size={14} className="text-content-secondary" />
                </TooltipPopoverTrigger>
                <TooltipPopoverContent className="flex flex-col gap-2">
                  The sum of all your borrow assets in Aave v3.
                </TooltipPopoverContent>
              </TooltipPopover>
            }
            initialValue={<NumberFlow value={protocolEntry?.totalBorrowValueUsd ?? 0} format={{ currency: "USD" }} />}
            finalValue={
              <NumberFlow
                value={Math.max((protocolEntry?.totalBorrowValueUsd ?? 0) - borrowMigrateValueUsd, 0)}
                format={{ currency: "USD" }}
              />
            }
          />
          {(protocolEntry?.totalBorrowValueUsd ?? 0) > 0 && (
            <div className="flex justify-between">
              <TooltipPopover>
                <TooltipPopoverTrigger className="flex items-center gap-1">
                  Flash Loan Fee
                  <Info size={14} className="text-content-secondary" />
                </TooltipPopoverTrigger>
                <TooltipPopoverContent className="flex flex-col gap-2 text-content-secondary">
                  <div className="text-content-primary label-md">Flash Loan Fee</div>
                  <p>
                    A flash loan is used to repay you Aave debt, which then allows withdrawing your collateral for
                    migration to the destination vault or market in a single transaction.
                  </p>
                  <div className="my-1 h-[1px] w-full bg-border-primary" />
                  <PoweredByMorpho />
                </TooltipPopoverContent>
              </TooltipPopover>
              <span className="text-accent-secondary">Free!</span>
            </div>
          )}
        </div>

        <div className="h-[1px] w-full bg-border-primary" />

        <NumberInputFormField
          control={form.control}
          name="maxSlippageTolerancePercent"
          labelContent={
            <TooltipPopover>
              <TooltipPopoverTrigger className="flex items-center gap-1 paragraph-md">
                Max Slippage
                <Info size={14} />
              </TooltipPopoverTrigger>
              <TooltipPopoverContent className="flex flex-col gap-2">
                <p>The maximum deviation from the quote you are willing to accept.</p>
                <p>
                  Higher slippages increase success rates but may result in worse prices, while lower slippages ensure
                  better prices but may cause transactions to fail.
                </p>
                <LinkExternal
                  href="https://github.com/papercliplabs/compound-blue/blob/main/src/actions/docs/aave-wind-down/technical-explination.md#slippage"
                  className="text-accent-primary"
                >
                  Learn more about how this is calculated
                </LinkExternal>
              </TooltipPopoverContent>
            </TooltipPopover>
          }
          unit="%"
        />

        <ProtocolMigratorHowItWorks />
      </CardContent>
    </>
  );
}

function ReservePositionRow({
  reservePosition,
  type,
}: {
  reservePosition: AaveV3ReservePosition;
  type: "supplying" | "borrowing";
}) {
  return (
    <div className="flex w-full items-center gap-3">
      <Image
        src={reservePosition.reserve.underlyingAsset.icon}
        alt={reservePosition.reserve.underlyingAsset.symbol}
        width={38}
        height={38}
        className="size-[38px] shrink-0 rounded-full"
      />
      <div className="flex flex-col justify-between">
        <span className="text-content-primary label-lg">{reservePosition.reserve.underlyingAsset.symbol}</span>
        <span className="text-content-secondary">
          {formatNumber(
            descaleBigIntToNumber(
              BigInt(type == "supplying" ? reservePosition.aTokenAssets : reservePosition.borrowAssets),
              reservePosition.reserve.aToken.decimals
            )
          )}
        </span>
      </div>
      <div className={clsx("ml-auto label-lg", type == "borrowing" && "text-semantic-negative")}>
        {formatNumber(type == "supplying" ? reservePosition.aTokenAssetsUsd : -reservePosition.borrowAssetsUsd, {
          currency: "USD",
        })}
      </div>
    </div>
  );
}
