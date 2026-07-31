import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "preciousadetola78@gmail.com" },
    update: { role: "admin" },
    create: {
      email: "preciousadetola78@gmail.com",
      name: "Admin",
      password: adminPassword,
      role: "admin",
    },
  });

  const categories = [
    { name: "Ready-to-Wear", slug: "ready-to-wear", description: "Everyday elegance crafted for the modern wardrobe." },
    { name: "Evening", slug: "evening", description: "Statement pieces for evening occasions." },
    { name: "Outerwear", slug: "outerwear", description: "Structured layers for the discerning." },
    { name: "Accessories", slug: "accessories", description: "The finishing touches." },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  const products = [
    { name: "Silk Column Dress", slug: "silk-column-dress", price: 85000, categorySlug: "ready-to-wear", stock: 12 },
    { name: "Tailored Blazer", slug: "tailored-blazer", price: 120000, categorySlug: "outerwear", stock: 8 },
    { name: "Wide-Leg Trousers", slug: "wide-leg-trousers", price: 65000, categorySlug: "ready-to-wear", stock: 0 },
    { name: "Cashmere Wrap", slug: "cashmere-wrap", price: 95000, categorySlug: "outerwear", stock: 3 },
    { name: "Linen Shirt", slug: "linen-shirt", price: 45000, categorySlug: "ready-to-wear", stock: 15 },
    { name: "Pleated Midi Skirt", slug: "pleated-midi-skirt", price: 72000, categorySlug: "ready-to-wear", stock: 7 },
    { name: "Structured Handbag", slug: "structured-handbag", price: 145000, categorySlug: "accessories", stock: 4 },
    { name: "Gold Cuff Bracelet", slug: "gold-cuff-bracelet", price: 38000, categorySlug: "accessories", stock: 20 },
    { name: "Embroidered Kaftan", slug: "embroidered-kaftan", price: 110000, categorySlug: "evening", stock: 5 },
    { name: "Leather Loafers", slug: "leather-loafers", price: 78000, categorySlug: "accessories", stock: 9 },
    { name: "Bamboo Earrings", slug: "bamboo-earrings", price: 22000, categorySlug: "accessories", stock: 30 },
    { name: "Oversized Scarf", slug: "oversized-scarf", price: 32000, categorySlug: "accessories", stock: 14 },
  ];

  for (const product of products) {
    const category = await prisma.category.findUnique({
      where: { slug: product.categorySlug },
    });

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: {
        name: product.name,
        slug: product.slug,
        description: `A meticulously crafted piece from the Adetola Luxe Archive.`,
        price: product.price,
        images: "[]",
        sizes: JSON.stringify(["XS", "S", "M", "L", "XL"]),
        colors: JSON.stringify(["#005C29", "#000000", "#D4AF37", "#FFFFFF"]),
        stock: product.stock,
        categoryId: category?.id,
        featured: false,
        published: true,
      },
    });
  }

  await prisma.discountCode.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10",
      type: "percentage",
      value: 10,
      active: true,
      usageLimit: 100,
    },
  });

  console.log("Database seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
