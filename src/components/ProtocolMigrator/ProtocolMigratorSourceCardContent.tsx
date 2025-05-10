"use client";
import { ComponentProps, useMemo } from "react";
import { CardContent, CardHeader } from "../ui/card";
import {
  SupportedProtocolsForProtocolMigration,
  useProtocoMigratorTableDataEntry,
} from "@/hooks/useProtocolMigratorTableData";
import Image from "next/image";
import NumberFlow, { NumberFlowWithLoading } from "../ui/NumberFlow";
import { Skeleton } from "../ui/skeleton";
import { Info } from "lucide-react";
import SliderFormField from "../FormFields/SliderFormField";
import { FormField } from "../ui/form";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../ui/tooltipPopover";
import { MetricChange } from "../MetricChange";
import { useWatchNumberField } from "@/hooks/useWatchNumberField";
import { useDebounce } from "use-debounce";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ProtocolMigratorSourceCardContentProps<TFieldValues extends Record<string, any>>
  extends Omit<ComponentProps<typeof FormField<TFieldValues>>, "render"> {
  protocolKey: SupportedProtocolsForProtocolMigration;
}

// Assume account is connected (handle in parent)
/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ProtocolMigratorSourceCardContent<TFieldValues extends Record<string, any>>({
  protocolKey,
  ...props
}: ProtocolMigratorSourceCardContentProps<TFieldValues>) {
  // const [isOpen, setIsOpen] = useState(false);
  const { data: protocolEntry, isLoading } = useProtocoMigratorTableDataEntry(protocolKey);

  const portfolioPercent = useWatchNumberField({ control: props.control, name: props.name });
  const [portfolioPercentDebounced] = useDebounce(portfolioPercent, 200);

  const migrateValueUsd = useMemo(() => {
    if (!protocolEntry) {
      return 0;
    } else {
      return protocolEntry.totalMigratableValueUsd * (portfolioPercentDebounced / 100);
    }
  }, [protocolEntry, portfolioPercentDebounced]);

  return (
    <>
      {/* <button onClick={() => setIsOpen(!isOpen)} className="w-full"> */}
      <CardHeader className="h-fit py-4 text-content-primary">
        <div className="flex gap-4">
          <Image src="/aave.png" alt="Aave" width={40} height={40} className="rounded-[8px]" />

          <div className="flex h-full flex-col items-start justify-between">
            <h3 className="title-5">Aave v3</h3>
            <span className="text-content-secondary">Protocol</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <NumberFlowWithLoading
            value={protocolEntry?.totalMigratableValueUsd}
            format={{ currency: "USD" }}
            isLoading={isLoading}
            loadingContent={<Skeleton className="h-[36px] w-[70px]" />}
            className="h-[36px]label-lg"
          />
          {/* <ChevronDown /> Not showing for now*/}
        </div>
      </CardHeader>
      {/* </button> */}

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
