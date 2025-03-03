import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { fallback, http } from "viem";
import { polygon } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  chains: [polygon],
  transports: {
    [polygon.id]: fallback([http(process.env.NEXT_PUBLIC_RPC_URL_1!), http(process.env.NEXT_PUBLIC_RPC_URL_2!)]),
  },
  ssr: true,

  projectId: "9e858cb5d9bceba08fef523bed55cae7",
  appName: "Compound Blue",
  appDescription: "DeFi lending and borrowing interface for Compound-managed deployments on the Morpho protocol.",
  appUrl: process.env.NEXT_PUBLIC_URL!,
  appIcon: `${process.env.NEXT_PUBLIC_URL}/icon.png`,
});
