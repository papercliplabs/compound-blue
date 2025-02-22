"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS: { href: string; name: string }[] = [
  { href: "/earn", name: "Earn" },
  { href: "/borrow", name: "Borrow" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2">
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={clsx(pathname.includes(item.href) && "underline")}>
          {item.name}
        </Link>
      ))}
    </div>
  );
}
