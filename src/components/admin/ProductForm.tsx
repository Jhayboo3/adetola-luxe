"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { ProductFormState } from "@/app/admin/products/actions";

type ProductValue = {
  name: string; slug: string; description: string; price: number; compareAt: number | null;
  stock: number; categoryId: string | null; images: string; sizes: string; colors: string;
  colorSelectable: boolean; featured: boolean; published: boolean; clothingType: string | null; targetGender: string;
};

const availableColors = ["Black", "White", "Cream", "Brown", "Gold", "Green", "Blue", "Red", "Pink", "Purple", "Orange", "Yellow", "Grey", "Silver", "Multi-colour"];

export default function ProductForm({ action, product, categories }: {
  action: (state: ProductFormState, data: FormData) => Promise<ProductFormState>;
  product?: ProductValue;
  categories: { id: string; name: string; parent: { name: string } | null }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [previews, setPreviews] = useState<string[]>(() => {
    if (!product) return [];
    try { return JSON.parse(product.images) as string[]; } catch { return []; }
  });
  const [colorSelectable, setColorSelectable] = useState(product?.colorSelectable ?? true);
  const selectedColors = (() => { try { return product ? (JSON.parse(product.colors) as string[]).map((color) => ({ "#005C29": "Green", "#000000": "Black", "#D4AF37": "Gold", "#FFFFFF": "White" }[color] ?? color)) : []; } catch { return []; } })();
  const list = (value?: string) => { try { return value ? (JSON.parse(value) as string[]).join(", ") : ""; } catch { return ""; } };

  return (
    <form action={formAction} className="mt-8 grid max-w-3xl grid-cols-1 gap-6" encType="multipart/form-data">
      {state.error && <p className="border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700">{state.error}</p>}
      <div className="grid gap-6 md:grid-cols-2">
        <Input id="name" name="name" label="Clothing Name" defaultValue={product?.name} required />
        <Input id="slug" name="slug" label="URL Slug (optional)" defaultValue={product?.slug} placeholder="Generated from the name" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Input id="clothingType" name="clothingType" label="Clothing Type" defaultValue={product?.clothingType ?? ""} placeholder="e.g. Long Sleeve Shirt" />
        <div className="flex flex-col gap-2"><label htmlFor="targetGender" className="font-body text-[12px] font-medium text-muted">Gender / Target Customer</label><select id="targetGender" name="targetGender" defaultValue={product?.targetGender ?? "Unisex"} className="h-[46px] border-b border-black bg-white font-body text-[14px] outline-none focus:border-gold"><option>Unisex</option><option>Male</option><option>Female</option></select></div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="font-body text-[12px] font-medium text-muted">Description</label>
        <textarea id="description" name="description" rows={5} required defaultValue={product?.description} className="border border-line bg-transparent p-3 font-body text-[14px] text-black outline-none focus:border-gold" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Input id="price" name="price" label="Price (₦)" type="number" min="1" step="0.01" defaultValue={product?.price} required />
        <Input id="compareAt" name="compareAt" label="Old Price (optional)" type="number" min="0" step="0.01" defaultValue={product?.compareAt ?? ""} />
        <Input id="stock" name="stock" label="Stock Quantity" type="number" min="0" step="1" defaultValue={product?.stock ?? 0} required />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Input id="sizes" name="sizes" label="Sizes (comma separated)" defaultValue={list(product?.sizes) || "XS, S, M, L, XL"} />
        <div className="rounded-2xl border border-line p-4">
          <label className="flex items-center gap-2 font-body text-[13px] font-medium"><input name="colorSelectable" type="checkbox" checked={colorSelectable} onChange={(event) => setColorSelectable(event.target.checked)} /> Customer can choose a color</label>
          <p className="mt-1 font-body text-[11px] text-muted">Turn this off for one-colour pieces or items sold exactly as shown.</p>
          {colorSelectable && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{availableColors.map((color) => <label key={color} className="flex items-center gap-2 font-body text-[12px]"><input name="colors" type="checkbox" value={color} defaultChecked={selectedColors.includes(color)} />{color}</label>)}</div>}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="categoryId" className="font-body text-[12px] font-medium text-muted">Category</label>
        <select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? ""} className="h-[46px] border-b border-black bg-white font-body text-[14px] outline-none focus:border-gold">
          <option value="">No category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.parent ? `${category.parent.name} → ${category.name}` : category.name}</option>)}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,360px)_1fr] md:items-end">
        <div className="grid grid-cols-2 gap-2">
          {previews.length ? previews.map((preview, index) => <div key={`${preview}-${index}`} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-line"><Image src={preview} alt={`Product preview ${index + 1}`} fill className="object-cover" unoptimized /></div>) : <div className="col-span-2 flex aspect-[4/3] items-center justify-center rounded-xl bg-line font-body text-[11px] text-muted">No images selected</div>}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="images" className="font-body text-[12px] font-medium text-muted">Clothing Images (up to 8 at once; JPG, PNG or WebP; max 5 MB each)</label>
          <input id="images" name="images" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length) setPreviews((current) => [...files.map((file) => URL.createObjectURL(file)), ...current]); }} className="max-w-full cursor-pointer rounded-xl border border-line bg-white p-2 font-body text-[12px] text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-body file:text-[11px] file:font-semibold file:uppercase file:tracking-[1px] file:text-black hover:file:bg-primary hover:file:text-white" />
          <p className="font-body text-[11px] text-muted">New images are added before existing images. The first image is used as the catalogue cover.</p>
          <p className="rounded-lg bg-[#F7F2E8] px-3 py-2 font-body text-[11px] leading-relaxed text-black">These images are different views of one product. For a different design, pattern, or style to have its own shop card, create a separate clothing product.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-6 font-body text-[13px]">
        <label className="flex items-center gap-2"><input name="published" type="checkbox" defaultChecked={product?.published ?? true} /> Visible in shop</label>
        <label className="flex items-center gap-2"><input name="featured" type="checkbox" defaultChecked={product?.featured ?? false} /> Featured product</label>
      </div>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button type="submit" disabled={pending}>{pending ? "Saving..." : product ? "Save Changes" : "Upload Clothing"}</Button>
        <Link href="/admin/products" className="inline-flex items-center px-6 font-body text-[13px] uppercase tracking-[1px] text-black no-underline">Cancel</Link>
      </div>
    </form>
  );
}
