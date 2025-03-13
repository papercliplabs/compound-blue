"server-only";
import { cache } from "react";
import { trackEvent } from "./trackEvent";

const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 500; // Exponential backoff on this base

/* eslint-disable @typescript-eslint/no-explicit-any */
export function cacheAndCatch<Args extends any[], T>(
  fn: (...args: Args) => Promise<T>,
  name: string
): (...args: Args) => Promise<T | null> {
  return cache(async (...args: Args): Promise<T | null> => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        console.log(`Running ${name}, attempt: ${attempt}`);
        return await fn(...args);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        console.error(`Data fetch error - invalid response in ${name}, attempt: ${attempt}, message: ${errorMessage}`);
        await trackEvent("data-fetch-error", { name, attempt, message: errorMessage });

        // Exponential backoff
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Expired all attempts...
    throw new Error("Data fetch error. Please try again.");
  });
}
