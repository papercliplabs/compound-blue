"use client";
import {
  SupportedProtocolsForProtocolMigration,
  useProtocoMigratorTableDataEntry,
} from "@/hooks/useProtocolMigratorTableData";

import { MetricWithTooltip } from "../Metric";
import { NumberFlowWithLoading } from "../ui/NumberFlow";
import { Skeleton } from "../ui/skeleton";

interface ProtocolMigratorValueHighlightProps {
  protocolKey: SupportedProtocolsForProtocolMigration;
}

export default function ProtocolMigratorValueHighlight({ protocolKey }: ProtocolMigratorValueHighlightProps) {
  const { data: protocolEntry, isLoading } = useProtocoMigratorTableDataEntry(protocolKey);

  return (
    <MetricWithTooltip
      label="Total Migrabable"
      tooltip="The total value of your migratable assets (supply - borrow)."
      className="title-3 md:items-end"
    >
      <NumberFlowWithLoading
        value={protocolEntry?.totalMigratableValueUsd}
        format={{ currency: "USD" }}
        isLoading={isLoading}
        loadingContent={<Skeleton className="h-[36px] w-[70px]" />}
        className="h-[36px]"
      />
    </MetricWithTooltip>
  );
}
