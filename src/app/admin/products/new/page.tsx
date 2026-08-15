import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/admin/ProductForm";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  await connection();
  const categories = await prisma.category.findMany({ orderBy: [{ parentId: "asc" }, { name: "asc" }], select: { id: true, name: true, parent: { select: { name: true } } } });
  return <div><Link href="/admin/products" className="font-body text-[11px] uppercase tracking-[2px] text-primary no-underline">&larr; Back to Clothing</Link><h1 className="mt-6 font-heading text-[24px] font-medium text-black">Add Clothing</h1><p className="mt-1 font-body text-[13px] text-muted">Upload a piece with its price and description</p><ProductForm action={createProduct} categories={categories} /></div>;
}
