"use server";
import { track } from "@vercel/analytics/server";

// Track event from server action so client can't block
export async function trackEvent(name: string, payload: Record<string, string | number>) {
  // Server logging for now in case the payload exceeds event max event size
  console.log("event-from-server: ", name, payload);
  await track(name, payload);
}
