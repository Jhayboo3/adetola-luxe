"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ImageGallery from "@/components/product/ImageGallery";
import SizeSelector from "@/components/product/SizeSelector";
import QuantitySelector from "@/components/product/QuantitySelector";
import Button from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/store/cart";
import { useToast } from "@/store/toast";

type DetailProduct = { id: string; name: string; slug: string; price: number; description: string; images: string[]; sizes: string[]; colors: string[]; colorSelectable: boolean; stock: number; category: string };

export default function ProductDetails({ product, storeSlug, storeName }: { product: DetailProduct; storeSlug?: string; storeName?: string }) {
  const hasColorOptions = product.colorSelectable && product.colors.length > 0;
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] ?? "One Size");
  const [selectedColor, setSelectedColor] = useState(hasColorOptions ? product.colors[0] : "As shown");
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCart((state) => state.addItem);
  const cartItems = useCart((state) => state.items);
  const toast = useToast((state) => state.show);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const soldOut = product.stock < 1;

  const handleAdd = () => {
    if (soldOut) return;
    const alreadyInCart = cartItems
      .filter((i) => i.productId === product.id && i.size === selectedSize && i.color === selectedColor)
      .reduce((sum, i) => sum + i.quantity, 0);
    const remaining = product.stock - alreadyInCart;
    if (quantity > remaining) {
      toast(`Only ${remaining} more in stock.`, "error", "Cannot add that many");
      setQuantity(Math.max(1, remaining));
      return;
    }
    addItem({ id: `${product.id}-${selectedSize}-${selectedColor}`, productId: product.id, name: product.name, price: product.price, image: product.images[0] ?? "", size: selectedSize, color: selectedColor, quantity, storeSlug, storeName });
    setQuantity(1);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 2200);
    toast(`Added ${quantity} × ${product.name} to your cart.`, "success", "Added to cart");
  };

  const onMaxError = (message: string) => toast(message, "error", "Quantity limit");

  const backHref = storeSlug ? `/${storeSlug}` : "/shop";

  return (
    <div className="py-10 md:py-16">
      <div className="mx-auto max-w-[1200px] px-8">
        <Link href={backHref} className="mb-6 inline-block font-body text-[11px] uppercase tracking-[2px] text-muted no-underline">&larr; Back to {storeSlug ? "store" : "marketplace"}</Link>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-12">
          <ImageGallery images={product.images} productName={product.name} />
          <div className="md:sticky md:top-8 md:self-start">
            <p className="font-body text-[11px] font-medium uppercase tracking-[2px] text-primary">{product.category}</p>
            <h1 className="mt-3 font-heading text-[28px] font-medium">{product.name}</h1>
            <p className="mt-2 font-heading text-[18px] text-primary-dark">{formatPrice(product.price)}</p>
            {storeSlug && storeName && <Link href={`/${storeSlug}`} className="mt-3 inline-block font-body text-[13px] text-primary underline underline-offset-4">Sold by {storeName}</Link>}
            {product.sizes.length > 0 && <div className="mt-8"><p className="mb-3 font-body text-[11px] font-medium uppercase tracking-[2px]">Size</p><SizeSelector sizes={product.sizes} selected={selectedSize} onSelect={setSelectedSize} /></div>}
            {hasColorOptions && <div className="mt-8"><p className="mb-3 font-body text-[11px] font-medium uppercase tracking-[2px]">Color</p><div className="flex flex-wrap gap-2">{product.colors.map((color) => <button type="button" key={color} onClick={() => setSelectedColor(color)} className={`rounded-full border px-4 py-2 font-body text-[11px] ${selectedColor === color ? "border-primary bg-primary text-white" : "border-line"}`}>{color}</button>)}</div></div>}
            <p className="mt-8 font-body text-[11px] text-muted">{soldOut ? "Sold Out" : product.stock > 5 ? "In Stock" : `Only ${product.stock} left`}</p>

            {!soldOut && (
              <div className="mt-5">
                <QuantitySelector value={quantity} max={product.stock} onChange={setQuantity} onMaxError={onMaxError} />
              </div>
            )}

            <div className="mt-6">
              <Button
                type="button"
                fullWidth
                onClick={handleAdd}
                disabled={soldOut || (hasColorOptions && !selectedColor)}
                className={added ? "animate-pop bg-primary text-white" : undefined}
              >
                {soldOut ? "Sold Out" : added ? "Added to Cart ✓" : quantity > 1 ? `Add ${quantity} to Cart` : "Add to Cart"}
              </Button>
            </div>
            {product.description && <section className="mt-8 border-t border-line pt-6"><h2 className="font-body text-[12px] font-semibold uppercase tracking-[1px]">About this product</h2><p className="mt-3 font-body text-[14px] leading-relaxed text-muted">{product.description}</p></section>}
          </div>
        </div>
      </div>
      <div className="fixed inset-x-0 z-30 flex items-center gap-3 border-t border-line bg-white px-4 py-2 shadow-[0_-4px_18px_rgba(15,42,34,0.08)] md:hidden" style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}>
        <span className="shrink-0 font-heading text-[15px]">{formatPrice(product.price)}</span>
        <Button type="button" fullWidth onClick={handleAdd} disabled={soldOut || (hasColorOptions && !selectedColor)} className="min-h-11 px-3 text-[11px]">{soldOut ? "Sold out" : added ? "Added ✓" : "Add to cart"}</Button>
      </div>
    </div>
  );
}
