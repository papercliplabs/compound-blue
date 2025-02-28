import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { polygon } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Compound Morpho",
  projectId: "9e858cb5d9bceba08fef523bed55cae7",
  chains: [polygon],
  transports: {
    [polygon.id]: http("https://polygon-rpc.com"),
  },
  ssr: true,
});
