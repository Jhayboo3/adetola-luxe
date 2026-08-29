"use client";

import { useState } from "react";
import Link from "next/link";
import ImageGallery from "@/components/product/ImageGallery";
import SizeSelector from "@/components/product/SizeSelector";
import Button from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/store/cart";

type DetailProduct = { id: string; name: string; slug: string; price: number; description: string; images: string[]; sizes: string[]; colors: string[]; colorSelectable: boolean; stock: number; category: string };

export default function ProductDetails({ product, storeSlug, storeName }: { product: DetailProduct; storeSlug?: string; storeName?: string }) {
  const hasColorOptions = product.colorSelectable && product.colors.length > 0;
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] ?? "One Size");
  const [selectedColor, setSelectedColor] = useState(hasColorOptions ? product.colors[0] : "As shown");
  const [added, setAdded] = useState(false);
  const addItem = useCart((state) => state.addItem);
  const handleAdd = () => {
    addItem({ id: `${product.id}-${selectedSize}-${selectedColor}`, productId: product.id, name: product.name, price: product.price, image: product.images[0] ?? "", size: selectedSize, color: selectedColor, quantity: 1, storeSlug, storeName });
    setAdded(true); setTimeout(() => setAdded(false), 2000);
  };
  const backHref = storeSlug ? `/${storeSlug}` : "/shop";
  return <div className="py-10 md:py-16"><div className="mx-auto max-w-[1200px] px-8">
    <Link href={backHref} className="mb-6 inline-block font-body text-[11px] uppercase tracking-[2px] text-muted no-underline">&larr; Back to {storeSlug ? "Store" : "Archive"}</Link>
    <div className="grid grid-cols-1 gap-12 md:grid-cols-[60%_40%]"><ImageGallery images={product.images} productName={product.name} />
      <div className="md:sticky md:top-8 md:self-start"><p className="font-body text-[11px] font-medium uppercase tracking-[2px] text-primary">{product.category}</p><h1 className="mt-3 font-heading text-[28px] font-medium">{product.name}</h1><p className="mt-2 font-heading text-[18px] text-gold">{formatPrice(product.price)}</p><p className="mt-6 font-serif text-[16px] leading-relaxed text-muted">{product.description}</p>
        {product.sizes.length > 0 && <div className="mt-8"><p className="mb-3 font-body text-[11px] font-medium uppercase tracking-[2px]">Size</p><SizeSelector sizes={product.sizes} selected={selectedSize} onSelect={setSelectedSize} /></div>}
        {hasColorOptions && <div className="mt-8"><p className="mb-3 font-body text-[11px] font-medium uppercase tracking-[2px]">Color</p><div className="flex flex-wrap gap-2">{product.colors.map((color) => <button type="button" key={color} onClick={() => setSelectedColor(color)} className={`rounded-full border px-4 py-2 font-body text-[11px] ${selectedColor === color ? "border-primary bg-primary text-white" : "border-line"}`}>{color}</button>)}</div></div>}
        <p className="mt-8 font-body text-[11px] text-muted">{product.stock > 5 ? "In Stock" : product.stock > 0 ? `Only ${product.stock} left` : "Sold Out"}</p>
        <div className="mt-8"><Button type="button" fullWidth onClick={handleAdd} disabled={product.stock < 1 || (hasColorOptions && !selectedColor)}>{added ? "Added to Cart" : product.stock < 1 ? "Sold Out" : "Add to Cart"}</Button></div>
      </div></div></div></div>;
}
