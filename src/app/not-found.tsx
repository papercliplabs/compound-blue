import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex w-full grow flex-col items-center justify-center gap-6 text-center">
      <h1>Page not found</h1>
      <p className="text-content-secondary">We couldn&apos;t find the page you were looking for.</p>
      <Link href="/">
        <Button>Return Home</Button>
      </Link>
    </div>
  );
}
