import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateUniqueStoreSlug } from "@/lib/store";
import { STORE_STATUSES } from "@/lib/store";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];

async function uploadImage(file: File | null, folder: string, maxBytes: number, storeId: string): Promise<string | null> {
  if (!file || !file.size) return null;
  if (!ALLOWED_IMAGE.includes(file.type)) throw new Error("Unsupported image format — please use a JPG, PNG, or WebP image.");
  if (file.size > maxBytes) throw new Error(`Image too large — it must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `${folder}/${storeId}-${crypto.randomUUID()}.${extension}`;
  const { env } = await getCloudflareContext({ async: true });
  await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return `/api/product-images/${key}`;
}

function toBool(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const storeName = str(formData, "storeName");
  const whatsapp = str(formData, "whatsapp");
  const phone = str(formData, "phone");
  const email2 = str(formData, "email2");
  const instagram = str(formData, "instagram");
  const preferredContact = str(formData, "preferredContact");
  const description = str(formData, "description");
  const category = str(formData, "category");
  const country = str(formData, "country");
  const state = str(formData, "state");
  const city = str(formData, "city");
  const area = str(formData, "area");
  const physicalAddress = str(formData, "physicalAddress");
  const mapLocation = str(formData, "mapLocation");
  const pickup = toBool(formData.get("pickup"));
  const delivery = toBool(formData.get("delivery"));
  const aboutStore = str(formData, "aboutStore");
  const productsDescription = str(formData, "productsDescription");
  const openingHours = str(formData, "openingHours");
  const deliveryAreas = str(formData, "deliveryAreas");
  const pickupInformation = str(formData, "pickupInformation");
  const paymentMethods = str(formData, "paymentMethods");
  const returnPolicy = str(formData, "returnPolicy");

  const logoFile = (formData.get("logo") as File | null) ?? null;
  const coverFile = (formData.get("coverImage") as File | null) ?? null;

  if (!email || !name || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!storeName) {
    return NextResponse.json({ error: "Enter a store name" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const slug = await generateUniqueStoreSlug(storeName);
  const storeId = crypto.randomUUID();

  let logo: string | null = null;
  let cover: string | null = null;
  try {
    logo = await uploadImage(logoFile, "logos", 2 * 1024 * 1024, storeId);
    cover = await uploadImage(coverFile, "covers", 5 * 1024 * 1024, storeId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not upload images" }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashed,
      role: "vendor",
      whatsapp: whatsapp || null,
      phone: phone || null,
    },
  });

  // A submitted application is PENDING — the store is NOT created as an
  // active/public store. It only goes live after a super admin approves it.
  await prisma.store.create({
    data: {
      id: storeId,
      name: storeName,
      slug,
      logo,
      coverImage: cover,
      whatsapp: whatsapp || null,
      phone: phone || null,
      email: email2 || null,
      instagramUrl: instagram || null,
      preferredContactMethod: preferredContact || null,
      description: description || null,
      category: category || null,
      country: country || null,
      state: state || null,
      city: city || null,
      area: area || null,
      physicalAddress: physicalAddress || null,
      mapLocation: mapLocation || null,
      pickupAvailable: pickup,
      deliveryAvailable: delivery,
      aboutStore: aboutStore || null,
      productsDescription: productsDescription || null,
      openingHours: openingHours || null,
      deliveryAreas: deliveryAreas || null,
      pickupInformation: pickupInformation || null,
      paymentMethods: paymentMethods || null,
      returnPolicy: returnPolicy || null,
      status: STORE_STATUSES.pending,
      ownerId: user.id,
    },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: STORE_STATUSES.pending,
  });
}
