import { trackEvent } from "@/data/trackEvent";

export async function safeFetch<T>(url: string, init?: RequestInit, throwOnError?: false): Promise<T | undefined>;
export async function safeFetch<T>(url: string, init: RequestInit | undefined, throwOnError: true): Promise<T>;
export async function safeFetch<T>(
  url: string,
  init?: RequestInit,
  throwOnError: boolean = false
): Promise<T | undefined> {
  try {
    const resp = await fetch(url, init);

    if (!resp.ok) {
      const message = `${resp.status}, ${await resp.text()}`;
      trackEvent("fetch-error-bad-response", { url, error: message });

      if (throwOnError) {
        throw new Error(`Fetch status error, ${resp.status}`);
      }
      return undefined;
    }

    return resp.json() as T;
  } catch (err) {
    trackEvent("fetch-error-threw", { url, error: `${err}` });
    if (throwOnError) {
      throw new Error("Fetch error");
    }
    return undefined;
  }
}
