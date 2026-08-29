import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "jeremiahoshiokhame@gmail.com" },
    update: { role: "admin" },
    create: {
      email: "jeremiahoshiokhame@gmail.com",
      name: "Jeremiah Momoh",
      password: adminPassword,
      role: "admin",
    },
  });

  // The platform's first store. Owner is the admin/seller account.
  const store = await prisma.store.upsert({
    where: { slug: "larkvine" },
    update: { ownerId: admin.id },
    create: {
      name: "Larkvine",
      slug: "larkvine",
      logo: null,
      whatsapp: "2347011033320",
      phone: "2347011033320",
      ownerId: admin.id,
    },
  });

  // A second demo vendor so the marketplace clearly shows multiple stores.
  const vendorUser = await prisma.user.upsert({
    where: { email: "vendor@larkvine.com" },
    update: { role: "vendor" },
    create: {
      email: "vendor@larkvine.com",
      name: "Trendy Closet",
      password: adminPassword,
      role: "vendor",
      whatsapp: "2348000000001",
      phone: "2348000000001",
    },
  });
  const vendorStore = await prisma.store.upsert({
    where: { slug: "trendy-closet" },
    update: { ownerId: vendorUser.id },
    create: {
      name: "Trendy Closet",
      slug: "trendy-closet",
      logo: null,
      whatsapp: "2348000000001",
      phone: "2348000000001",
      ownerId: vendorUser.id,
    },
  });

  const vendorCategories = [
    { name: "Shoes", slug: "shoes", description: "Footwear for every occasion." },
    { name: "Beauty", slug: "beauty", description: "Cosmetics and skincare." },
  ];
  for (const cat of vendorCategories) {
    await prisma.category.upsert({
      where: { storeId_slug: { storeId: vendorStore.id, slug: cat.slug } },
      update: { name: cat.name, description: cat.description },
      create: { ...cat, storeId: vendorStore.id },
    });
  }
  const vendorProducts = [
    { name: "Urban Sneakers", slug: "urban-sneakers", price: 60000, categorySlug: "shoes" },
    { name: "Glow Serum", slug: "glow-serum", price: 18000, categorySlug: "beauty" },
  ];
  for (const product of vendorProducts) {
    const category = await prisma.category.findUnique({ where: { storeId_slug: { storeId: vendorStore.id, slug: product.categorySlug } } });
    await prisma.product.upsert({
      where: { storeId_slug: { storeId: vendorStore.id, slug: product.slug } },
      update: {},
      create: {
        name: product.name,
        slug: product.slug,
        storeId: vendorStore.id,
        description: `A carefully curated piece from ${vendorStore.name}.`,
        price: product.price,
        images: "[]",
        sizes: JSON.stringify(["L", "M", "XL", "XXL", "XXXL"]),
        colors: JSON.stringify(["#000000", "#FFFFFF"]),
        stock: 25,
        categoryId: category?.id,
        featured: true,
        published: true,
      },
    });
  }

  const categories = [
    { name: "Ready-to-Wear", slug: "ready-to-wear", description: "Everyday elegance crafted for the modern wardrobe." },
    { name: "Evening", slug: "evening", description: "Statement pieces for evening occasions." },
    { name: "Outerwear", slug: "outerwear", description: "Structured layers for the discerning." },
    { name: "Accessories", slug: "accessories", description: "The finishing touches." },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: cat.slug } },
      update: { name: cat.name, description: cat.description },
      create: { ...cat, storeId: store.id },
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
      where: { storeId_slug: { storeId: store.id, slug: product.categorySlug } },
    });

    await prisma.product.upsert({
      where: { storeId_slug: { storeId: store.id, slug: product.slug } },
      update: {},
      create: {
        name: product.name,
        slug: product.slug,
        storeId: store.id,
        description: `A meticulously crafted piece from the Larkvine Archive.`,
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
    where: { storeId_code: { storeId: store.id, code: "WELCOME10" } },
    update: {},
    create: {
      code: "WELCOME10",
      type: "percentage",
      value: 10,
      active: true,
      usageLimit: 100,
      storeId: store.id,
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
