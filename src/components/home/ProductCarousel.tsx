import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";

export type CarouselProduct = {
  id: string;
  name: string;
  price: number;
  slug: string;
  description?: string;
  stock?: number;
  images?: string[];
  storeSlug?: string;
  storeName?: string;
  storeLogo?: string | null;
};

interface ProductCarouselProps {
  title: string;
  href?: string;
  viewAllLabel?: string;
  products: CarouselProduct[];
}

export default function ProductCarousel({ title, href = "/shop", viewAllLabel = "View All", products }: ProductCarouselProps) {
  return (
    <section className="py-8 md:py-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-heading text-[22px] font-medium text-black md:text-[28px]">{title}</h2>
          <Link href={href} className="font-body text-[11px] font-medium uppercase tracking-[2px] text-primary no-underline transition-colors hover:text-primary-light">
            {viewAllLabel}
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="rounded-[24px] bg-[#F5F0E9] px-8 py-14 text-center font-body text-[13px] text-muted">
            Nothing here yet — check back soon.
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 [scrollbar-width:thin]">
            <div className="flex w-max gap-4 sm:gap-6">
              {products.map((product) => (
                <div key={product.id} className="w-[220px] shrink-0 md:w-[250px]">
                  <ProductCard product={product} storeSlug={product.storeSlug} storeName={product.storeName} storeLogo={product.storeLogo} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
