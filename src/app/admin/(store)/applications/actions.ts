"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/store";
import { STORE_STATUSES } from "@/lib/store";

// Approve a store application: make the store live and record approval time.
// The vendor's dashboard (products, categories, orders, discounts) unlocks
// automatically because store-scoped actions require an APPROVED store.
export async function approveApplication(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  if (!id) throw new Error("Missing store id");

  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) throw new Error("Store not found");

  await prisma.store.update({
    where: { id },
    data: {
      status: STORE_STATUSES.approved,
      approvedAt: new Date(),
      rejectionReason: null,
    },
  });

  revalidatePath("/admin/applications");
  revalidatePath("/admin/stores");
  revalidatePath("/", "layout");
}

export async function rejectApplication(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const reason = String(formData.get("reason") || "").trim();
  if (!id) throw new Error("Missing store id");

  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) throw new Error("Store not found");

  await prisma.store.update({
    where: { id },
    data: {
      status: STORE_STATUSES.rejected,
      rejectionReason: reason || null,
      approvedAt: null,
    },
  });

  revalidatePath("/admin/applications");
  revalidatePath("/admin/stores");
}
