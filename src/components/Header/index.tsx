import Link from "next/link";

import ClaimRewards from "../ClaimRewards";
import ConnectWalletButton from "../ConnectWalletButton";
import Logo from "../ui/icons/Logo";
import LogoCopy from "../ui/icons/LogoCopy";

import Nav from "./Nav";

export default function Header() {
  return (
    <header className="h-header sticky top-0 z-[20] flex w-full items-center justify-center bg-background-primary backdrop-blur-xl">
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
