import Link from "next/link";
import Nav from "./Nav";
import LogoCopy from "../ui/icons/LogoCopy";
import Logo from "../ui/icons/Logo";
import ConnectWalletButton from "../ConnectWalletButton";
import ClaimRewards from "../ClaimRewards";

export const HEADER_HEIGHT = 76;

export default function Header() {
  return (
    <header
      className="sticky top-0 z-[20] flex w-full items-center justify-center bg-background-primary/60 backdrop-blur-xl"
      style={{ height: HEADER_HEIGHT }}
    >
      <div className="flex w-full max-w-screen-xl items-center justify-between p-4">
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/" className="group flex items-center gap-1">
            <Logo className="transition-transform duration-300" />
            <LogoCopy className="hidden md:block" />
          </Link>
          <Nav />
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <ClaimRewards />
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}
