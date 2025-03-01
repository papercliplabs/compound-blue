import { getMarket } from "@/data/whisk/getMarket";
import Link from "next/link";
import { getAddress, Hex, isHex } from "viem";
import { ArrowLeft } from "lucide-react";
import { ReactNode, Suspense } from "react";
import { Skeleton, Skeletons } from "@/components/ui/skeleton";
import MarketIcon from "@/components/MarketIcon";
import { formatNumber } from "@/utils/format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Apy from "@/components/Apy";
import Metric from "@/components/Metric";
import VaultAllocationTable from "@/components/tables/VaultAllocationTable";
import { LinkExternalBlockExplorer } from "@/components/LinkExternal";
import Image from "next/image";
import IrmChart from "@/components/IrmChart";
import { UserMarketPosition, UserMarketPositionHighlight } from "@/components/UserMarketPosition";
import MarketActions from "@/components/MarketActions";

export default async function MarketPage({ params }: { params: Promise<{ marketId: string }> }) {
  const marketId = (await params).marketId as Hex;
  if (!isHex(marketId)) {
    return <div>Invalid market id</div>;
  }

  return (
    <>
      <section className="flex flex-col justify-between gap-6 md:flex-row">
        <div className="flex flex-col gap-3">
          <Link href="/borrow" className="flex items-center gap-2 font-semibold text-content-secondary">
            <ArrowLeft size={16} className="stroke-content-secondary" /> Borrow
          </Link>

          <Suspense
            fallback={
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="flex items-center">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <Skeleton className="ml-[-12px] h-9 w-9 rounded-full" />
                  </div>
                  <Skeleton className="w-[200px]" />
                </div>
              </div>
            }
          >
            <MarketMetadata marketId={marketId} />
          </Suspense>
        </div>

        <UserMarketPositionHighlight marketId={marketId} />
      </section>

      <div className="flex w-full flex-col gap-5 lg:flex-row">
        <div className="flex min-w-0 grow flex-col gap-5">
          <Card>
            <CardHeader>Key Metrics</CardHeader>
            <CardContent>
              <Suspense
                fallback={
                  <div className="flex flex-wrap gap-x-8 gap-y-4">
                    <Skeletons count={3} className="h-[56px] flex-1" />
                  </div>
                }
              >
                <MarketState marketId={marketId} />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>Vault Allocation</CardHeader>
            <CardContent className="p-0">
              <Suspense fallback={<Skeleton className="m-4 h-[400px] rounded-[16px]" />}>
                <VaultAllocationTableWrapper marketId={marketId} />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>Interest Rate Model</CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-[152px] w-full" />}>
                <MarketIrm marketId={marketId} />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>Market Info</CardHeader>
            <CardContent>
              <Suspense
                fallback={
                  <div className="grid grid-cols-3 gap-y-10">
                    <Skeletons count={6} className="h-[56px] w-[180px] grow" />
                  </div>
                }
              >
                <MarketInfo marketId={marketId} />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-[min(364px,100%)] flex-col gap-5 md:max-w-[364px]">
          <Suspense
            fallback={
              <Card>
                <CardContent>
                  <Skeleton className="h-[170px] w-full" />
                </CardContent>
              </Card>
            }
          >
            <MarketActionsWrapper marketId={marketId} />
          </Suspense>
          <Card>
            <CardContent className="flex flex-col gap-7">
              <span className="font-semibold text-content-secondary paragraph-sm">Position Summary</span>
              <UserMarketPosition marketId={marketId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

async function MarketMetadata({ marketId }: { marketId: Hex }) {
  const market = await getMarket(marketId);

  if (!market) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
      <MarketIcon loanAssetInfo={market.loanAsset} collateralAssetInfo={market.collateralAsset} />
      <div className="flex items-center gap-4">
        <h1 className="whitespace-nowrap title-2">{market.name}</h1>
        <div className="rounded-[4px] bg-button-neutral px-1 font-semibold text-content-secondary paragraph-lg">
          {formatNumber(market.lltv, { style: "percent", minimumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  );
}

async function MarketState({ marketId }: { marketId: Hex }) {
  const market = await getMarket(marketId);

  if (!market) {
    return null;
  }

  const metrics: { label: string; description: string; value: ReactNode }[] = [
    {
      label: "Total Deposits",
      description: "The total amount of assets currently deposited into the market.",
      value: formatNumber(market.supplyAssetsUsd, { currency: "USD" }),
    },
    {
      label: "Available Liquidity",
      description:
        "The total amount of assets available to borrow, including liquidity that can be reallocated from other markets through the public allocator.",
      value: formatNumber(market.liquidityAssetsUsd, { currency: "USD" }),
    },
    {
      label: "Borrow Rate",
      description: "The annual percent yield (APY) payed by borrowing from this market.",
      value: <Apy type="supply" apy={market.borrowApy} />,
    },
  ];

  return (
    <div className="flex flex-wrap justify-between gap-x-8 gap-y-4">
      {metrics.map((metric, i) => (
        <Metric key={i} label={metric.label} description={metric.description} className="flex-1">
          <span className="title-3">{metric.value}</span>
        </Metric>
      ))}
    </div>
  );
}

async function VaultAllocationTableWrapper({ marketId }: { marketId: Hex }) {
  const market = await getMarket(marketId);

  if (!market) {
    return null;
  }

  return <VaultAllocationTable allocations={market.vaultAllocations} />;
}

async function MarketIrm({ marketId }: { marketId: Hex }) {
  const market = await getMarket(marketId);

  if (!market) {
    return null;
  }

  const metrics: { label: string; description: string; value: ReactNode }[] = [
    {
      label: "Target Utilization",
      description: "TODO.",
      value: formatNumber(market.irm.targetUtilization, { style: "percent" }),
    },
    {
      label: "Current Utilization",
      description: "TODO.",
      value: formatNumber(market.utilization, { style: "percent" }),
    },
    {
      label: "Interest Rate Model",
      description: "TODO.",
      value: <LinkExternalBlockExplorer address={getAddress(market.irm.address)} />,
    },
  ];

  return (
    <div className="flex flex-col justify-between gap-8 lg:flex-row">
      <div className="flex flex-col justify-between gap-6">
        {metrics.map((metric, i) => (
          <Metric key={i} label={metric.label} description={metric.description}>
            <span className="title-5">{metric.value}</span>
          </Metric>
        ))}
      </div>
      {market.irm.curve && <IrmChart data={market.irm.curve} currentUtilization={market.utilization} />}
    </div>
  );
}

async function MarketInfo({ marketId }: { marketId: Hex }) {
  const market = await getMarket(marketId);

  if (!market) {
    return null;
  }

  const metrics: { label: string; description: string; value: ReactNode }[] = [
    {
      label: "LLTV",
      description: "TODO.",
      value: formatNumber(market.lltv, { style: "percent" }),
    },
    {
      label: "Liquidation Penality",
      description: "TODO.",
      value: formatNumber(market.liquidationPenalty, { style: "percent" }),
    },
    {
      label: "Oracle Address",
      description: "TODO.",
      value: <LinkExternalBlockExplorer address={getAddress(market.oracleAddress)} />,
    },
    {
      label: "Collateral Asset",
      description: "TODO",
      value: market.collateralAsset ? (
        <LinkExternalBlockExplorer address={getAddress(market.collateralAsset.address)}>
          {market.collateralAsset.icon && (
            <Image
              src={market.collateralAsset.icon}
              alt={market.collateralAsset.symbol}
              width={20}
              height={20}
              className="rounded-full"
            />
          )}
          {market.collateralAsset.symbol}
        </LinkExternalBlockExplorer>
      ) : (
        "None"
      ),
    },
    {
      label: "Loan Asset",
      description: "TODO",
      value: (
        <LinkExternalBlockExplorer address={getAddress(market.loanAsset.address)}>
          {market.loanAsset.icon && (
            <Image
              src={market.loanAsset.icon}
              alt={market.loanAsset.symbol}
              width={20}
              height={20}
              className="rounded-full"
            />
          )}
          {market.loanAsset.symbol}
        </LinkExternalBlockExplorer>
      ),
    },
    {
      label: "Oracle Price",
      description: "TODO",
      value: `1 ${market.loanAsset.symbol} = ${formatNumber(market.collateralPriceInLoanAsset)} ${market.collateralAsset?.symbol}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-y-4 md:grid-cols-3 md:gap-y-10">
      {metrics.map((metric, i) => (
        <Metric key={i} label={metric.label} description={metric.description}>
          <span className="title-5">{metric.value}</span>
        </Metric>
      ))}
    </div>
  );
}

async function MarketActionsWrapper({ marketId }: { marketId: Hex }) {
  const market = await getMarket(marketId);

  if (!market) {
    return null;
  }

  return <MarketActions market={market} />;
}

export const dynamic = "force-static";
export const revalidate = 60;
