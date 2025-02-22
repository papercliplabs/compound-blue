import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet, polygon } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
    appName: "Compound Morpho",
    projectId: "9e858cb5d9bceba08fef523bed55cae7",
    chains: [mainnet, polygon, base],
    ssr: true,
});
