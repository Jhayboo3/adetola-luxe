"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isGarmentSize } from "@/lib/measurements";

export type ProfileState = { error?: string; success?: string };
const phonePattern = /^\+?[0-9 ()-]{7,20}$/;

function value(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

export async function saveProfile(_state: ProfileState, data: FormData): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Please sign in again before saving your profile." };

  const name = value(data, "name");
  const phone = value(data, "phone");
  const whatsapp = value(data, "whatsapp");
  const gender = value(data, "gender");
  const address = value(data, "address");
  const state = value(data, "state");
  const city = value(data, "city");
  const zip = value(data, "zip");
  const deliveryInfo = value(data, "deliveryInfo");
  const size = value(data, "size");

  if (!name || !phone || !whatsapp || !address || !state || !city) return { error: "Complete all required personal and delivery information." };
  if (!phonePattern.test(phone) || !phonePattern.test(whatsapp)) return { error: "Enter valid phone and WhatsApp numbers." };
  if (!isGarmentSize(size)) return { error: "Choose a garment size (L, M, XL, XXL, XXXL)." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, phone, whatsapp, gender: gender || null, address, state, city, zip: zip || null, deliveryInfo: deliveryInfo || null, measurements: JSON.stringify({ size }) },
  });
  revalidatePath("/account/profile");
  revalidatePath("/checkout");
  return { success: "Your profile has been saved." };
}

export async function savePersonalInfo(_state: ProfileState, data: FormData): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Please sign in again before saving." };

  const name = value(data, "name");
  const phone = value(data, "phone");
  const whatsapp = value(data, "whatsapp");
  const gender = value(data, "gender");

  if (!name) return { error: "Name is required." };
  if (phone && !phonePattern.test(phone)) return { error: "Enter a valid phone number." };
  if (whatsapp && !phonePattern.test(whatsapp)) return { error: "Enter a valid WhatsApp number." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, phone: phone || null, whatsapp: whatsapp || null, gender: gender || null },
  });
  revalidatePath("/account/profile");
  return { success: "Personal information saved." };
}

export async function saveDeliveryInfo(_state: ProfileState, data: FormData): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Please sign in again before saving." };

  const address = value(data, "address");
  const state = value(data, "state");
  const city = value(data, "city");
  const zip = value(data, "zip");
  const deliveryInfo = value(data, "deliveryInfo");

  if (!address || !state || !city) return { error: "Address, state, and city are required." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { address, state, city, zip: zip || null, deliveryInfo: deliveryInfo || null },
  });
  revalidatePath("/account/profile");
  revalidatePath("/checkout");
  return { success: "Delivery information saved." };
}

export async function saveGarmentSize(_state: ProfileState, data: FormData): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Please sign in again before saving." };

  const size = value(data, "size");
  if (!isGarmentSize(size)) return { error: "Choose a garment size (L, M, XL, XXL, XXXL)." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { measurements: JSON.stringify({ size }) },
  });
  revalidatePath("/account/profile");
  return { success: "Garment size saved." };
}
