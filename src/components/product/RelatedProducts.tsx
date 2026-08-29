import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";

export type RelatedProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  description?: string;
  stock?: number;
  images?: string[];
  storeSlug?: string;
  storeName?: string;
  storeLogo?: string | null;
};

export default function RelatedProducts({ products, title = "You May Also Like" }: { products: RelatedProduct[]; title?: string }) {
  if (!products.length) return null;
  return (
    <section className="py-10 md:py-14">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-heading text-[22px] font-medium text-black md:text-[26px]">{title}</h2>
          <Link href="/shop" className="font-body text-[11px] font-medium uppercase tracking-[2px] text-primary no-underline transition-colors hover:text-primary-light">View All</Link>
        </div>
        <div className="-mx-8 overflow-x-auto px-8 pb-2 [scrollbar-width:thin]" data-carousel={title}>
          <div className="flex w-max gap-4 sm:gap-6">
            {products.map((p) => (
              <div key={p.id} className="w-[220px] shrink-0 md:w-[250px]">
                <ProductCard product={p} storeSlug={p.storeSlug} storeName={p.storeName} storeLogo={p.storeLogo} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
