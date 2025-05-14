"use server";
import { revalidatePath } from "next/cache";

export async function revalidatePages() {
  revalidatePath("/borrow", "page");
  revalidatePath("/borrow/[marketId]", "page");
  revalidatePath("/supply", "page");
  revalidatePath("/supply/[vaultAddress]", "page");
  revalidatePath("/migrate", "page");
}
