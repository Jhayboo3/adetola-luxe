"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { measurementFields, validMeasurement } from "@/lib/measurements";

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
  const measurementUnit = value(data, "measurementUnit") || "inches";

  if (!name || !phone || !whatsapp || !address || !state || !city) return { error: "Complete all required personal and delivery information." };
  if (!phonePattern.test(phone) || !phonePattern.test(whatsapp)) return { error: "Enter valid phone and WhatsApp numbers." };
  if (gender !== "Male" && gender !== "Female") return { error: "Select Male or Female." };
  if (!['inches', 'centimeters'].includes(measurementUnit)) return { error: "Choose a valid measurement unit." };

  const measurements: Record<string, number> = {};
  const missing: string[] = [];
  for (const [key, label] of measurementFields(gender)) {
    const number = Number(value(data, key));
    if (!validMeasurement(number)) missing.push(label);
    else measurements[key] = number;
  }
  if (missing.length) return { error: `Complete valid measurements for: ${missing.join(", ")}.` };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, phone, whatsapp, gender, address, state, city, zip: zip || null, deliveryInfo: deliveryInfo || null, measurementUnit, measurements: JSON.stringify(measurements) },
  });
  revalidatePath("/account/profile");
  revalidatePath("/checkout");
  return { success: "Your profile and measurements have been saved." };
}
