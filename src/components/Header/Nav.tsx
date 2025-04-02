"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { ReactNode } from "react";
import BarChart from "../ui/icons/BarChart";
import CirclePlus from "../ui/icons/CirclePlus";
import ArrowFatLineDown from "../ui/icons/ArrowFatLineDown";

const NAV_ITEMS: { href: string; name: string; icon?: ReactNode; isNew?: boolean }[] = [
  { href: "/", name: "Earn", icon: <BarChart className="fill-content-secondary" /> },
  { href: "/borrow", name: "Borrow", icon: <CirclePlus className="fill-content-secondary" /> },
  { href: "/migrate", name: "Migrate", icon: <ArrowFatLineDown className="fill-content-secondary" />, isNew: true },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <div className="flex w-full items-center gap-2 overflow-x-auto">
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
            className="h-8 gap-[6px] px-4"
          >
            {item.icon && item.icon}
            {item.name}
            {item.isNew && (
              <span className="bg-background-accent h-4 rounded-[4px] px-1 text-xs text-accent-primary">New</span>
            )}
          </Button>
        </Link>
      ))}
    </div>
  );
}
