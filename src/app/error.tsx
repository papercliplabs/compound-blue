"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect } from "react";
import { trackEvent } from "@/data/trackEvent";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void trackEvent("app-error", { message: error.message });
    console.error(error);
  }, [error]);

  return (
    <div className="flex w-full grow flex-col items-center justify-center gap-6 text-center">
      <h1>Oops! Something went wrong.</h1>
      <p className="text-content-secondary">Our team has been notified. Please try again.</p>
      <Button onClick={() => reset()}>Try again</Button>
      <Link href="/">
        <Button variant="secondary">Return Home</Button>
      </Link>
    </div>
  );
}
