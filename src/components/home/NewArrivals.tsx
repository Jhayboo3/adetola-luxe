import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";

export default function NewArrivals({ products }: { products: { id: string; name: string; price: number; slug: string; images: string[] }[] }) {
  return (
    <section className="py-20 md:py-24">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <div className="mb-4 h-[2px] w-12 bg-gold" />
            <h2 className="font-heading text-[28px] font-medium text-black">
              New Arrivals
            </h2>
          </div>
          <Link
            href="/shop"
            className="font-body text-[11px] font-medium uppercase tracking-[2px] text-primary no-underline transition-colors hover:text-primary-light"
          >
            View All
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        {products.length === 0 && <div className="rounded-[24px] bg-[#F5F0E9] px-8 py-16 text-center font-body text-[13px] text-muted">New clothing will appear here as soon as it is uploaded.</div>}
      </div>
    </section>
  );
}
