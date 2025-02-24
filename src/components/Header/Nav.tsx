"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";

const NAV_ITEMS: { href: string; name: string }[] = [
  { href: "/earn", name: "Earn" },
  { href: "/borrow", name: "Borrow" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2">
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href}>
          <Button variant={pathname.includes(item.href) ? "secondary" : "ghost"} size="sm">
            {item.name}
          </Button>
        </Link>
      ))}
    </div>
  );
}
