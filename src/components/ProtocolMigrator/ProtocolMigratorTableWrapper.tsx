"use client";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useAccount } from "wagmi";

import { useProtocolMigratorTableData } from "@/hooks/useProtocolMigratorTableData";

import BorrowEducationalSummary from "../EducationalSummary/BorrowEducationalSummary";
import EarnEducationalSummary from "../EducationalSummary/EarnEducationalSummary";
import ProtocolMigrationTable from "../tables/ProtocolMigrationTable";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import Wallet from "../ui/icons/Wallet";
import { Skeleton } from "../ui/skeleton";

export default function ProtocolMigratorTableWrapper() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const { data: tableData, isLoading } = useProtocolMigratorTableData();

  if (!isConnected) {
    return (
      <div className="flex w-full flex-col items-center gap-5 rounded-[12px] bg-background-secondary px-4 py-16 text-center">
        <Wallet className="h-12 w-12 fill-content-secondary" />
        <span className="text-content-secondary label-lg">Connect your wallet to view your migratable protocols.</span>
        <Button onClick={openConnectModal}>Connect Wallet</Button>
        <div className="flex w-full flex-col justify-center gap-6 pt-9 md:flex-row">
          <EarnEducationalSummary showLink={false} />
          <BorrowEducationalSummary showLink={false} />
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>Protocols</CardHeader>
      <CardContent className="flex justify-center p-0">
        {isLoading || tableData == undefined ? (
          <Skeleton className="m-8 h-[200px] w-full" />
        ) : tableData.length == 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="flex flex-col gap-4">
              <p className="text-content-secondary title-5">You don&apos;t have anything to migrate.</p>
            </div>
            <div className="flex w-full flex-col justify-center gap-6 md:flex-row">
              <Link href="/">
                <Button>Go to Earn</Button>
              </Link>
              <Link href="/borrow">
                <Button variant="borrow">Go to Borrow</Button>
              </Link>
            </div>
          </div>
        ) : (
          <ProtocolMigrationTable data={tableData} />
        )}
      </CardContent>
    </Card>
  );
}
