"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { ProductFormState } from "@/app/admin/products/actions";
import { uploadFileKey } from "@/lib/product-upload";

type ProductValue = {
  name: string; slug: string; description: string; price: number; compareAt: number | null;
  stock: number; categoryId: string | null; images: string; sizes: string; colors: string;
  colorSelectable: boolean; featured: boolean; published: boolean; clothingType: string | null; targetGender: string;
};

const availableColors = ["Black", "White", "Cream", "Brown", "Gold", "Green", "Blue", "Red", "Pink", "Purple", "Orange", "Yellow", "Grey", "Silver", "Multi-colour"];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ProductForm({ action, product, categories }: {
  action: (state: ProductFormState, data: FormData) => Promise<ProductFormState>;
  product?: ProductValue;
  categories: { id: string; name: string; parent: { name: string } | null }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [existingPreviews] = useState<string[]>(() => {
    if (!product) return [];
    try { return JSON.parse(product.images) as string[]; } catch { return []; }
  });
  const [selectedUploads, setSelectedUploads] = useState<{ file: File; preview: string }[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [colorSelectable, setColorSelectable] = useState(product?.colorSelectable ?? true);
  const selectedColors = (() => { try { return product ? (JSON.parse(product.colors) as string[]).map((color) => ({ "#005C29": "Green", "#000000": "Black", "#D4AF37": "Gold", "#FFFFFF": "White" }[color] ?? color)) : []; } catch { return []; } })();
  const list = (value?: string) => { try { return value ? (JSON.parse(value) as string[]).join(", ") : ""; } catch { return ""; } };
  useEffect(() => {
    if (!state.completedFiles?.length) return;
    const completed = new Set(state.completedFiles);
    const timer = window.setTimeout(() => {
      setSelectedUploads((current) => current.filter(({ file }) => !completed.has(uploadFileKey(file))));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [state.completedFiles]);
  const submitAction = (data: FormData) => {
    data.delete("images");
    selectedUploads.forEach(({ file }) => data.append("images", file));
    formAction(data);
  };
  const previews = [...selectedUploads.map(({ preview }) => preview), ...existingPreviews];

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const invalidType = files.find((f) => !ALLOWED_IMAGE_TYPES.includes(f.type));
    if (invalidType) {
      setImageError(`"${invalidType.name}" is not a supported format — please use JPG, PNG, or WebP images.`);
      return;
    }
    const tooLarge = files.find((f) => f.size > MAX_IMAGE_BYTES);
    if (tooLarge) {
      setImageError(`"${tooLarge.name}" is too large — each image must be smaller than 5 MB.`);
      return;
    }
    if (files.length + selectedUploads.length > 20) {
      setImageError("You can select no more than 20 images at once.");
      return;
    }
    if (files.length + selectedUploads.length + existingPreviews.length > 10) {
      setImageError("A product can have up to 10 images in total.");
      return;
    }
    setImageError(null);
    setSelectedUploads((current) => {
      const known = new Set(current.map(({ file }) => uploadFileKey(file)));
      const additions = files.filter((file) => !known.has(uploadFileKey(file))).map((file) => ({ file, preview: URL.createObjectURL(file) }));
      return [...current, ...additions];
    });
  };

  return (
    <form action={submitAction} className="mt-8 grid max-w-3xl grid-cols-1 gap-6" encType="multipart/form-data">
      {state.error && <p className="border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700">{state.error}</p>}
      {state.success && <p className="border border-green-200 bg-green-50 p-4 font-body text-[13px] text-green-800">{state.success}</p>}
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
          {previews.length ? previews.map((preview, index) => <div key={`${preview}-${index}`} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-line"><Image src={preview} alt={`Product preview ${index + 1}`} fill sizes="180px" className="object-cover" unoptimized /></div>) : <div className="col-span-2 flex aspect-[3/4] items-center justify-center rounded-xl bg-line font-body text-[11px] text-muted">No images selected</div>}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="imagePicker" className="font-body text-[12px] font-medium text-muted">Clothing Images (up to 20; JPG, PNG or WebP; max 5 MB each)</label>
          <input id="imagePicker" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleImageSelect} className="max-w-full cursor-pointer rounded-xl border border-line bg-white p-2 font-body text-[12px] text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-body file:text-[11px] file:font-semibold file:uppercase file:tracking-[1px] file:text-black hover:file:bg-primary hover:file:text-white" />
          {imageError && <p className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-body text-[12px] text-red-700"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">!</span>{imageError}</p>}
          <p className="font-body text-[11px] text-muted">{selectedUploads.length} new {selectedUploads.length === 1 ? "file" : "files"} selected. You can choose files again to append more before saving.</p>
          {!product && <label className="rounded-lg bg-[#F7F2E8] px-3 py-3 font-body text-[11px] leading-relaxed text-black"><span className="flex items-start gap-2"><input name="separateProducts" type="checkbox" defaultChecked className="mt-0.5" /><span><strong>Create each image as a separate clothing product.</strong><br />Use this for different designs that need separate catalogue cards. Turn it off only when the images are different views of the same product.</span></span></label>}
          {product && <p className="rounded-lg bg-[#F7F2E8] px-3 py-2 font-body text-[11px] leading-relaxed text-black">New images are added as additional views of this existing product.</p>}
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
