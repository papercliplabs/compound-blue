import { expect, test } from "@playwright/test";

test("smoke - has title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Compound Blue | Earn/);
});

test("smoke - has rpc url", async () => {
  const rpc = process.env.NEXT_PUBLIC_RPC_URL_1;
  expect(rpc).toBeDefined();
});
