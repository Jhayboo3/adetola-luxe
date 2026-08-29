import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    slug: string;
    description?: string;
    stock?: number;
    images?: string[];
    sizes?: string[];
    colors?: string[];
  };
  // When provided, product links are store-scoped: `/{storeSlug}/{productSlug}`.
  // Otherwise they fall back to the legacy `/shop/{productSlug}` route.
  storeSlug?: string;
}

export default function ProductCard({ product, storeSlug }: ProductCardProps) {
  const href = storeSlug ? `/${storeSlug}/${product.slug}` : `/shop/${product.slug}`;
  return (
    <article className="group flex h-full min-w-0 flex-col">
      <Link href={href} className="block no-underline">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[16px] bg-line shadow-[0_8px_28px_rgba(15,42,34,0.07)] sm:rounded-[20px] md:rounded-[26px]">
        {product.images?.[0] ? (
          <Image src={product.images[0]} alt={product.name} fill sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" unoptimized />
        ) : <div className="flex h-full w-full items-center justify-center bg-[#E5DDD3] transition-transform duration-500 group-hover:scale-[1.03]">
          <span className="font-body text-[11px] uppercase tracking-[2px] text-muted">
            Image
          </span>
        </div>}
        </div>
      </Link>
      <div className="mt-3 flex flex-1 flex-col sm:mt-4">
        <Link href={href} className="no-underline">
          <h3 className="font-heading text-[15px] font-medium leading-tight text-black sm:text-[16px]">
          {product.name}
          </h3>
        </Link>
        <p className="mt-1 font-body text-[13px] font-semibold text-black">
          {formatPrice(product.price)}
        </p>
        {product.description && <p className="mt-2 line-clamp-2 font-body text-[11px] leading-relaxed text-muted sm:text-[12px]">{product.description}</p>}
        <div className="mt-3 space-y-1 font-body text-[10px] leading-relaxed text-muted sm:text-[11px]">
          {product.sizes?.length ? <p><span className="font-semibold text-black">Sizes:</span> {product.sizes.join(" · ")}</p> : null}
          {product.colors?.length ? <p className="line-clamp-1"><span className="font-semibold text-black">Colours:</span> {product.colors.join(" · ")}</p> : null}
          {typeof product.stock === "number" && <p className={product.stock > 0 ? "text-primary" : "text-red-700"}>{product.stock > 0 ? `${product.stock <= 5 ? "Low stock" : "In stock"} · ${product.stock} available` : "Sold out"}</p>}
        </div>
        <Link href={href} className="cta-secondary mt-4 min-h-11 px-3 py-2 text-[9px] sm:text-[10px]">View Product</Link>
      </div>
    </article>
  );
}
