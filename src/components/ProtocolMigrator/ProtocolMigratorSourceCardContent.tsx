"use client";
import clsx from "clsx";
import { ChevronDown, Info } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { ComponentProps, useMemo, useState } from "react";

import { AaveV3ReservePosition } from "@/data/whisk/getAaveV3MarketPosition";
import { useAaveV3MarketPosition } from "@/hooks/useAaveV3MarketPosition";
import {
  SupportedProtocolsForProtocolMigration,
  useProtocoMigratorTableDataEntry,
} from "@/hooks/useProtocolMigratorTableData";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";

import SliderFormField from "../FormFields/SliderFormField";
import { MetricChange } from "../MetricChange";
import { CardContent, CardHeader } from "../ui/card";
import { FormField } from "../ui/form";
import NumberFlow, { NumberFlowWithLoading } from "../ui/NumberFlow";
import { Skeleton } from "../ui/skeleton";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../ui/tooltipPopover";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ProtocolMigratorSourceCardContentProps<TFieldValues extends Record<string, any>>
  extends Omit<ComponentProps<typeof FormField<TFieldValues>>, "render"> {
  protocolKey: SupportedProtocolsForProtocolMigration;
  migrateValueUsd: number;
}

// Assume account is connected (handle in parent)
/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ProtocolMigratorSourceCardContent<TFieldValues extends Record<string, any>>({
  protocolKey,
  migrateValueUsd,
  ...props
}: ProtocolMigratorSourceCardContentProps<TFieldValues>) {
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

  return (
    <>
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full" type="button">
        <CardHeader className="h-fit py-4 text-content-primary">
          <div className="flex gap-4">
            <Image src="/aave.png" alt="Aave" width={40} height={40} className="rounded-[8px]" />

            <div className="flex h-full flex-col items-start justify-between">
              <h3 className="title-5">Aave v3</h3>
              <span className="text-content-secondary">Protocol</span>
            </div>
          </div>

          <div className="-mr-2 flex items-center gap-1">
            <NumberFlowWithLoading
              value={protocolEntry?.totalMigratableValueUsd}
              format={{ currency: "USD" }}
              isLoading={isLoading}
              loadingContent={<Skeleton className="h-[36px] w-[70px]" />}
              className="h-[36px]label-lg"
            />
            <ChevronDown className={clsx("transition-transform duration-300", isExpanded && "-rotate-180")} />
          </div>
        </CardHeader>
      </button>

      <motion.div
        initial={{ height: "0px" }}
        animate={{ height: isExpanded ? "auto" : "0px" }}
        className="w-full overflow-hidden bg-background-inverse"
      >
        <div className="flex flex-col gap-6 px-8 py-3">
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
        </div>
      </motion.div>

      <CardContent className="flex flex-col gap-8">
        <div>
          <SliderFormField
            {...props}
            includeInput={false}
            labelContent={
              <div className="flex w-full justify-between">
                <TooltipPopover>
                  <TooltipPopoverTrigger className="flex items-center gap-1">
                    Amount to migrate
                    <Info size={16} />
                  </TooltipPopoverTrigger>
                  <TooltipPopoverContent className="flex flex-col gap-2">
                    <p>
                      The percentage of your entire Aave v3 balance you want to migrate. This includes all lending and
                      borrowing positions.
                    </p>
                  </TooltipPopoverContent>
                </TooltipPopover>

                <NumberFlow
                  value={migrateValueUsd}
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

        <div className="flex flex-col gap-2">
          <MetricChange
            name="Balance (Aave v3)"
            initialValue={
              <NumberFlow value={protocolEntry?.totalMigratableValueUsd ?? 0} format={{ currency: "USD" }} />
            }
            finalValue={
              <NumberFlow
                value={Math.max((protocolEntry?.totalMigratableValueUsd ?? 0) - migrateValueUsd, 0)}
                format={{ currency: "USD" }}
              />
            }
          />
        </div>
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
      <div className="ml-auto label-lg">
        {formatNumber(type == "supplying" ? reservePosition.aTokenAssetsUsd : reservePosition.borrowAssetsUsd, {
          currency: "USD",
        })}
      </div>
    </div>
  );
}
