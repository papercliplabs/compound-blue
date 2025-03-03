import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { fallback, http } from "viem";
import { polygon } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Compound Blue",
  projectId: "9e858cb5d9bceba08fef523bed55cae7",
  chains: [polygon],
  transports: {
    [polygon.id]: fallback([http(process.env.NEXT_PUBLIC_RPC_URL_1!), http(process.env.NEXT_PUBLIC_RPC_URL_2!)]),
  },
  ssr: true,
});
