"server-only";
import { cache } from "react";
import { track } from "@vercel/analytics/server";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function cacheAndCatch<Args extends any[], T>(
  fn: (...args: Args) => Promise<T>,
  name: string
): (...args: Args) => Promise<T | null> {
  return cache(async (...args: Args): Promise<T | null> => {
    try {
      console.log("Running", name);
      return await fn(...args);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Data fetch error - invalid response in ${name}: ${errorMessage}`);
      await track("data-fetch-error", { message: errorMessage });
      return null;
    }
  });
}
