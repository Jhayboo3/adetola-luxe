import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/admin/ProductForm";
import { updateProduct } from "../actions";
import { requireStore } from "@/lib/store";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await requireStore();
  const [product, categories] = await Promise.all([
    prisma.product.findFirst({ where: { id, storeId: store.id } }),
    prisma.category.findMany({ where: { storeId: store.id }, orderBy: [{ parentId: "asc" }, { name: "asc" }], select: { id: true, name: true, parent: { select: { name: true } } } }),
  ]);
  if (!product) notFound();
  const action = updateProduct.bind(null, id);
  return <div><Link href="/admin/products" className="font-body text-[11px] uppercase tracking-[2px] text-primary no-underline">&larr; Back to Clothing</Link><h1 className="mt-6 font-heading text-[24px] font-medium text-black">Edit Clothing</h1><p className="mt-1 font-body text-[13px] text-muted">Update product details or upload a new image</p><ProductForm action={action} product={product} categories={categories} /></div>;
}
