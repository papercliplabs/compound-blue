"use client";
import clsx from "clsx";
import { ArrowBigDownDash } from "lucide-react";
import Link from "next/link";

import { useProtocoMigratorTableDataEntry } from "@/hooks/useProtocolMigratorTableData";
import { formatNumber } from "@/utils/format";

import { Button } from "../ui/button";
interface ProtocolMigratorBannerProps {
  variant: "earn" | "borrow";
}

export default function ProtocolMigratorBanner({ variant }: ProtocolMigratorBannerProps) {
  const { data: protocolEntry } = useProtocoMigratorTableDataEntry("aave-v3");

  if (!protocolEntry || protocolEntry.totalMigratableValueUsd == 0) {
    return null;
  }

  return (
    <Link
      href="/migrate/aave-v3"
      className={clsx(
        "w-full transition-all label-lg hover:brightness-90",
        "flex items-center gap-2 rounded-[12px] p-4",
        variant == "borrow" ? "bg-button-borrow-deemphasized" : "bg-button-supply-deemphasized"
      )}
    >
      <ArrowBigDownDash
        className={clsx("size-6 shrink-0", variant == "borrow" ? "text-button-borrow" : "text-button-supply")}
      />
      <div className="label-lg">
        You have{" "}
        <span className={clsx(variant == "borrow" ? "text-button-borrow" : "text-button-supply")}>
          {formatNumber(protocolEntry.totalMigratableValueUsd, { currency: "USD" })}
        </span>{" "}
        that you could be {variant == "borrow" ? "borrowing" : "earning"} more with.
      </div>

      <Button size="sm" variant={variant == "borrow" ? "borrow" : "primary"} className="ml-auto">
        Migrate
      </Button>
    </Link>
  );
}
