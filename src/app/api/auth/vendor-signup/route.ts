import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateUniqueStoreSlug } from "@/lib/store";
import { STORE_STATUSES } from "@/lib/store";

export async function POST(req: Request) {
  const { name, email, password, storeName, whatsapp, phone, description } = await req.json();

  if (!email || !name || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (!storeName?.trim()) {
    return NextResponse.json({ error: "Enter a store name" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const slug = await generateUniqueStoreSlug(storeName);

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
      name: storeName.trim(),
      slug,
      logo: null,
      whatsapp: whatsapp || null,
      phone: phone || null,
      description: description?.trim() || null,
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
