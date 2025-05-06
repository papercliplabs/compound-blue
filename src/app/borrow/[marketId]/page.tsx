import { getMarket, isNonIdleMarket } from "@/data/whisk/getMarket";
import Link from "next/link";
import { getAddress, Hex, isHex, zeroAddress } from "viem";
import { ArrowLeft, Info } from "lucide-react";
import { ReactNode, Suspense } from "react";
import { Skeleton, Skeletons } from "@/components/ui/skeleton";
import { formatNumber } from "@/utils/format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Apy, { ApyTooltipContent } from "@/components/Apy";
import Metric, { Metric as MetricComponent } from "@/components/Metric";
import VaultAllocationTable from "@/components/tables/VaultAllocationTable";
import { LinkExternalBlockExplorer } from "@/components/LinkExternal";
import Image from "next/image";
import IrmChart from "@/components/IrmChart";
import MarketActions from "@/components/MarketActions";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { WHITELISTED_MARKET_IDS } from "@/config";
import BackButton from "@/components/BackButton";
import { AccountMarketPosition, AccountMarketPositionHighlight } from "@/components/AccountMarketPosition";
import MarketAvailableLiquidity, { MarketAvailableLiquidityTooltip } from "@/components/MarketAvailableLiquidity";
import NumberFlow from "@/components/ui/NumberFlow";
import { MarketIcon } from "@/components/MarketIdentifier";
import { TooltipPopover, TooltipPopoverTrigger, TooltipPopoverContent } from "@/components/ui/tooltipPopover";
import { isAssetVaultShare } from "@/utils/isAssetVaultShare";

export const metadata: Metadata = {
  title: "Compound Blue | Market",
};

export default async function MarketPage({ params }: { params: Promise<{ marketId: string }> }) {
  const marketId = (await params).marketId as Hex;
  if (!isHex(marketId)) {
    notFound();
  }

  if (!WHITELISTED_MARKET_IDS.includes(marketId)) {
    return <UnsupportedMarket />;
  }

  return (
    <>
      <section className="flex flex-col justify-between gap-6 md:flex-row">
        <div className="flex flex-col gap-3">
          <Link href="/borrow" className="flex items-center gap-2 text-content-secondary label-md">
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

        <Suspense fallback={null}>
          <AccountMarketPositonHighlightWrapper marketId={marketId} />
        </Suspense>
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
              <Suspense fallback={<Skeleton className="m-8 h-[400px]" />}>
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

        <div className="flex min-w-[min(364px,100%)] flex-col gap-5 lg:max-w-[364px]">
          <Suspense
            fallback={
              <Card>
                <CardContent>
                  <Skeleton className="h-[300px] w-full" />
                </CardContent>
              </Card>
            }
          >
            <MarketActionsWrapper marketId={marketId} />
          </Suspense>
          <Card>
            <CardContent className="flex flex-col gap-7">
              <span className="text-content-secondary label-sm">Position Summary</span>
              <Suspense fallback={<Skeleton className="h-[240px] w-full" />}>
                <UserMarketPositionWrapper marketId={marketId} />
              </Suspense>
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
    notFound();
  }

  const collateralRehypothecation = isAssetVaultShare(getAddress(market.collateralAsset?.address ?? zeroAddress));

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
      <MarketIcon
        loanAssetInfo={market.loanAsset}
        collateralAssetInfo={market.collateralAsset}
        className="border-background-primary"
      />
      <div className="flex items-center gap-4">
        <h1 className="whitespace-nowrap title-2">{market.name}</h1>
        <div className="rounded-[4px] bg-button-neutral px-1 text-content-secondary label-lg">
          {formatNumber(market.lltv, { style: "percent", minimumFractionDigits: 0 })}
        </div>
      </div>
      {collateralRehypothecation && (
        <TooltipPopover>
          <TooltipPopoverTrigger className="flex items-center gap-1 text-content-secondary label-sm">
            <div>Rehypothecation</div>
            <Info size={16} className="stroke-content-secondary" />
          </TooltipPopoverTrigger>
          <TooltipPopoverContent className="flex flex-col gap-2">
            <p>
              This market uses vault shares as collateral. Your deposited assets remain in the vault, earning yield,
              while the vault shares themselves are used as collateral for borrowing.
            </p>
            <p>This improves capital efficiency, but also introduces additional risk.</p>
          </TooltipPopoverContent>
        </TooltipPopover>
      )}
    </div>
  );
}

async function MarketState({ marketId }: { marketId: Hex }) {
  const market = await getMarket(marketId);

  if (!market) {
    return null;
  }

  const metrics: { label: string; tooltip: ReactNode; value: ReactNode }[] = [
    {
      label: "Total Deposits",
      tooltip: "The total amount of assets currently deposited into the market.",
      value: <NumberFlow className="title-3" value={market.supplyAssetsUsd} format={{ currency: "USD" }} />,
    },
    {
      label: "Available Liquidity",
      tooltip: (
        <MarketAvailableLiquidityTooltip
          liquidityAssetUsd={market.liquidityAssetsUsd}
          publicAllocatorSharedLiquidityAssetsUsd={market.publicAllocatorSharedLiquidityAssetsUsd}
        />
      ),
      value: (
        <MarketAvailableLiquidity
          className="title-3"
          liquidityAssetUsd={market.liquidityAssetsUsd}
          publicAllocatorSharedLiquidityAssetsUsd={market.publicAllocatorSharedLiquidityAssetsUsd}
          showTooltip={false}
        />
      ),
    },
    {
      label: "Borrow APY",
      tooltip: <ApyTooltipContent apy={market.borrowApy} type="borrow" />,
      value: <Apy className="title-3" type="borrow" apy={market.borrowApy} showTooltip={false} />,
    },
  ];

  return (
    <div className="flex flex-wrap justify-between gap-x-8 gap-y-4">
      {metrics.map((metric, i) => (
        <div key={i} className="flex-1">
          <TooltipPopover>
            <TooltipPopoverTrigger>
              <MetricComponent label={metric.label}>{metric.value}</MetricComponent>
            </TooltipPopoverTrigger>
            <TooltipPopoverContent>{metric.tooltip}</TooltipPopoverContent>
          </TooltipPopover>
        </div>
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
      description: "The target utilization level of the market.",
      value: formatNumber(market.irm.targetUtilization, { style: "percent" }),
    },
    {
      label: "Current Utilization",
      description: "The current utilization level of the market.",
      value: <NumberFlow value={market.utilization} format={{ style: "percent" }} />,
    },
    {
      label: "Interest Rate Model",
      description: "The address of the interest rate model contract.",
      value: <LinkExternalBlockExplorer address={getAddress(market.irm.address)} />,
    },
  ];

  return (
    <div className="flex flex-col justify-between gap-8 lg:flex-row">
      <div className="flex flex-col justify-between gap-6 md:flex-row lg:flex-col">
        {metrics.map((metric, i) => (
          <Metric key={i} label={metric.label} description={metric.description} className="flex-1">
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
      description:
        "The liquidation loan-to-value (LLTV) threshold sets the limit at which positions become eligible for liquidation.",
      value: formatNumber(market.lltv, { style: "percent" }),
    },
    {
      label: "Liquidation Penality",
      description: "The penalty incurred by borrowers upon liquidation, designed to incentivize liquidators.",
      value: formatNumber(market.liquidationPenalty, { style: "percent" }),
    },
    {
      label: "Oracle Address",
      description: "The address of the oracle contract used to price the collateral asset.",
      value: <LinkExternalBlockExplorer address={getAddress(market.oracleAddress)} />,
    },
    {
      label: "Collateral Asset",
      description: "The collateral asset of the market that can be used to borrow against.",
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
      description: "The loan asset of the market that can be borrowed.",
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
      description: "The current price from the oracle.",
      value: `1 ${market.collateralAsset?.symbol} = ${formatNumber(market.collateralPriceInLoanAsset)} ${market.loanAsset.symbol}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-y-8 md:grid-cols-3 md:gap-y-10">
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
  if (!isNonIdleMarket(market)) {
    return null;
  }

  return <MarketActions market={market} />;
}

async function UserMarketPositionWrapper({ marketId }: { marketId: Hex }) {
  const market = await getMarket(marketId);

  if (!isNonIdleMarket(market)) {
    return null;
  }

  return <AccountMarketPosition market={market} />;
}

function UnsupportedMarket() {
  return (
    <div className="flex w-full grow flex-col items-center justify-center gap-6 text-center">
      <h1>Unsupported Market</h1>
      <p className="text-content-secondary">This market is not currently supported on the Compound Blue interface.</p>
      <BackButton />
    </div>
  );
}

async function AccountMarketPositonHighlightWrapper({ marketId }: { marketId: Hex }) {
  const market = await getMarket(marketId);

  if (!isNonIdleMarket(market)) {
    return null;
  }

  return <AccountMarketPositionHighlight market={market} />;
}

export const dynamic = "force-static";
export const revalidate = 60;
