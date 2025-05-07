"use server";

// Track event from server action so client can't block
export async function trackEvent(name: string, payload: Record<string, string | number>) {
  // Server logging for now in case the payload exceeds event max event size
  console.log("event-from-server: ", name, payload);

  // Plausible
  if (process.env.NEXT_PUBLIC_PLAUSIBLE_DATA_DOMAIN) {
    try {
      const resp = await fetch("https://plausible.paperclip.xyz/api/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: process.env.NEXT_PUBLIC_URL!,
        },
        body: JSON.stringify({
          domain: process.env.NEXT_PUBLIC_PLAUSIBLE_DATA_DOMAIN,
          name,
          url: process.env.NEXT_PUBLIC_URL,
          props: payload,
        }),
      });
      if (!resp.ok) {
        console.error("Plausible event tracking failed", resp.status, await resp.text(), { name, payload });
      }
    } catch (e) {
      console.error("Plausible event tracking failed", e, { name, payload });
    }
  }
}
