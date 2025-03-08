import { WHITELISTED_MARKET_IDS, WHITELISTED_VAULT_ADDRESSES } from "@/config";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vaultPages = WHITELISTED_VAULT_ADDRESSES.map((address) => ({
    url: `https://www.compound.blue/earn/${address}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  })) as MetadataRoute.Sitemap;

  const marketPages = WHITELISTED_MARKET_IDS.map((id) => ({
    url: `https://www.compound.blue/borrow/${id}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  })) as MetadataRoute.Sitemap;

  return [
    {
      url: "https://www.compound.blue/earn",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://www.compound.blue/borrow",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...vaultPages,
    ...marketPages,
  ];
}
