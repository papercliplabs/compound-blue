import { Suspense } from "react";
import { Skeleton } from "../ui/skeleton";
import { getVaultSummaries } from "@/data/whisk/getVaultSummaries";
import EarnTableTable from "./EarnTableTable";

export default async function EarnTable() {
  return (
    <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-[16px]" />}>
      <EarnTableWrapper />
    </Suspense>
  );
}

async function EarnTableWrapper() {
  const vaultSummaries = await getVaultSummaries();
  return <EarnTableTable vaultSummaries={vaultSummaries} />;
}
