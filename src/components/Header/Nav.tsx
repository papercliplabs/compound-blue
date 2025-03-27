"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";

const NAV_ITEMS: { href: string; name: string }[] = [
  { href: "/", name: "Earn" },
  { href: "/borrow", name: "Borrow" },
  { href: "/migrate", name: "Migrate" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-5 md:gap-2">
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href}>
          <Button
            variant={
              (item.href === "/" && (pathname === "/" || pathname.match(/^\/0x[a-fA-F0-9]{40}$/))) ||
              (item.href === "/borrow" && pathname.startsWith("/borrow")) ||
              (item.href === "/migrate" && pathname == "/migrate")
                ? "secondary"
                : "ghost"
            }
            size="md"
            className="h-7 px-4"
          >
            {item.name}
          </Button>
        </Link>
      ))}
    </div>
  );
}
