import Link from "next/link";

import ClaimRewards from "../ClaimRewards";
import ConnectWalletButton from "../ConnectWalletButton";
import Logo from "../ui/icons/Logo";
import LogoCopy from "../ui/icons/LogoCopy";

import Nav from "./Nav";
import LinkExternal from "../LinkExternal";

export default function Header() {
  return (
    <header className="h-header sticky top-0 z-[20] flex w-full flex-col items-center justify-center bg-background-primary backdrop-blur-xl">
      <div className="bg-background-warning text-semantic-warning w-full flex justify-center items-center text-center grow">
        <span className="whitespace-pre-wrap px-4">
          Polygon POS network is undergoing scheduled maintenance, refer to <LinkExternal href="https://forum.polygon.technology/t/heimdall-v2-migration/21017" className="inline underline span" hideArrow>Heimdall V2 Migration</LinkExternal> for more updates.
        </span>
      </div>
      <div className="flex w-full max-w-screen-xl flex-col gap-2 p-4 pb-2 md:pb-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/" className="group flex items-center gap-1">
              <Logo className="transition-transform duration-300" />
              <LogoCopy />
            </Link>
            <div className="hidden md:block">
              <Nav />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <ClaimRewards />
            <ConnectWalletButton />
          </div>
        </div>
        <div className="md:hidden">
          <Nav />
        </div>
      </div>
    </header>
  );
}
