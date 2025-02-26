import Link from "next/link";
import { ModeToggle } from "./ModeToggle";

export default function Footer() {
  return (
    <footer className="flex h-[64px] w-full items-center justify-center justify-self-end font-semibold text-content-secondary">
      <div className="xxxx mx-6 flex h-full w-full max-w-screen-xl items-center justify-between border-t">
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
        </div>
        <ModeToggle />
      </div>
    </footer>
  );
}
