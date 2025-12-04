import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";

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

  // Supress wallet connect SSR error: "indexedDB is not defined".
  // https://github.com/WalletConnect/walletconnect-monorepo/issues/6841
  // undefined will make rainbowkit use it's default wallets when on the client (injectedWallet config is server only so won't be used).
  wallets: typeof indexedDB === "undefined" ? [{ groupName: "Wallets", wallets: [injectedWallet] }] : undefined,
});
