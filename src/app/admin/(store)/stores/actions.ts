"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/store";
import { STORE_STATUSES } from "@/lib/store";

export async function updateStoreStatus(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!id || !Object.values(STORE_STATUSES).includes(status as never)) throw new Error("Invalid request");

  await prisma.store.update({
    where: { id },
    data:
      status === STORE_STATUSES.approved
        ? { status, approvedAt: new Date(), rejectionReason: null }
        : { status },
  });

  revalidatePath("/admin/stores");
  revalidatePath("/admin/applications");
  revalidatePath("/", "layout");
}

// Toggle a store's verified badge. Only the platform super admin may grant or
// revoke verification.
export async function setStoreVerified(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const verified = formData.get("verified") === "1";
  if (!id) throw new Error("Missing store id");
  await prisma.store.update({ where: { id }, data: { isVerified: verified } });
  revalidatePath("/admin/stores");
  revalidatePath("/admin/applications");
  revalidatePath("/", "layout");
}
