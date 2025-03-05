"use server";
import { revalidatePath } from "next/cache";

export async function revalidateDynamicPages() {
  revalidatePath("/borrow", "page");
  revalidatePath("/borrow/[marketId]", "page");
  revalidatePath("/supply", "page");
  revalidatePath("/supply/[vaultAddress]", "page");
}
