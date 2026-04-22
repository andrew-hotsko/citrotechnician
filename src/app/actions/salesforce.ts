"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { runSync, testConnection } from "@/lib/salesforce/sync";

async function requireAdminOrOps() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    throw new Error("Only admins and ops managers can run Salesforce sync");
  }
  return user;
}

/** Manual "Sync now" button on Settings → Salesforce. */
export async function manualSync() {
  const user = await requireAdminOrOps();
  const result = await runSync({
    triggeredBy: "MANUAL",
    triggeredById: user.id,
  });
  revalidatePath("/settings/salesforce");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/customers");
  revalidatePath("/properties");
  return result;
}

/** "Test connection" button — verifies env vars + auth without writing. */
export async function probeSalesforce() {
  await requireAdminOrOps();
  return testConnection();
}
