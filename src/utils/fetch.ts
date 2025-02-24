export async function safeFetch<T>(url: string, init?: RequestInit): Promise<T | undefined> {
  try {
    const resp = await fetch(url, init);

    if (!resp.ok) {
      console.error(`Error - safeFetch bad response: ${resp.status}, ${await resp.text()}`);
      return undefined;
    }

    return resp.json() as T;
  } catch (err) {
    console.error(`Error - safeFetch invalid response: ${err}`);
    return undefined;
  }
}
