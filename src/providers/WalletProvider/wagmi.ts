import { getDefaultConfig } from "@rainbow-me/rainbowkit";

import { CHAIN, TRANSPORTS } from "@/config";

export const wagmiConfig = getDefaultConfig({
  chains: [CHAIN],
  transports: {
    [CHAIN.id]: TRANSPORTS,
  },
  ssr: true,
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,
  appName: "Compound Blue",
  appDescription: "DeFi lending and borrowing interface for Compound-managed deployments on the Morpho protocol.",
  appUrl: process.env.NEXT_PUBLIC_URL!,
  appIcon: `${process.env.NEXT_PUBLIC_URL}/icon.png`,
});
