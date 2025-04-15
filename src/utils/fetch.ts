import { trackEvent } from "@/data/trackEvent";

export async function safeFetch<T>(url: string, init?: RequestInit): Promise<T | undefined> {
  try {
    const resp = await fetch(url, init);

    if (!resp.ok) {
      const message = `${resp.status}, ${await resp.text()}`;
      trackEvent("fetch-error-bad-response", { url, error: message });
      return undefined;
    }

    return resp.json() as T;
  } catch (err) {
    trackEvent("fetch-error-threw", { url, error: `${err}` });
    return undefined;
  }
}
