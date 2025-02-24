import { getMarket } from "@/data/whisk/getMarket";
import { Hex } from "viem";

export default async function MarketPage({ params }: { params: Promise<{ marketId: string }> }) {
  const marketId = (await params).marketId as Hex;
  const market = await getMarket(marketId);

  if (!market) {
    return <div>Market not found</div>;
  }

  return (
    <div>
      {market.borrowAssets}
      <h1>{market.name}</h1>
    </div>
  );
}

export const dynamic = "force-static";
export const revalidate = 60;
