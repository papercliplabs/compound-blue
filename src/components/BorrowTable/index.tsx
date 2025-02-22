import { Suspense } from "react";
import { Skeleton } from "../ui/skeleton";
import { getMarketSummaries } from "@/data/whisk/getMarketSummaries";
import BorrowTableTable from "./BorrowTableTable";

export default async function BorrowTable() {
  return (
    <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-[16px]" />}>
      <BorrowTableWrapper />
    </Suspense>
  );
}

async function BorrowTableWrapper() {
  const marketSummaries = await getMarketSummaries();
  return <BorrowTableTable marketSummaries={marketSummaries} />;
}
