import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import Nav from "./Nav";

export default function Header() {
  return (
    <header className="sticky top-0 flex w-full items-center justify-center bg-white">
      <div className="relative flex w-full max-w-screen-xl items-center justify-between p-4">
        <Link href="/">Compound</Link>
        <div className="absolute left-1/2 -translate-x-1/2">
          <Nav />
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
