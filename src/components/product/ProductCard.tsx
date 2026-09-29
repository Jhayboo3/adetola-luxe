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
  // The vendor display name shown on the card. When present a clickable "Store"
  // row is rendered that links to the storefront `/{storeSlug}`.
  storeName?: string;
  // The vendor's logo, shown inside the store badge when available.
  storeLogo?: string | null;
}

export default function ProductCard({ product, storeSlug, storeName, storeLogo }: ProductCardProps) {
  const href = storeSlug ? `/${storeSlug}/${product.slug}` : `/shop/${product.slug}`;
  return (
    <article className="group flex h-full min-w-0 flex-col">
      <Link href={href} className="block no-underline">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-line">
        {product.images?.[0] ? (
          <Image src={product.images[0]} alt={product.name} fill sizes="(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 23vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" unoptimized />
        ) : <div className="flex h-full w-full items-center justify-center bg-[#E5DDD3] transition-transform duration-500 group-hover:scale-[1.03]">
          <span className="font-body text-[11px] uppercase tracking-[2px] text-muted">
            Image
          </span>
        </div>}
        </div>
      </Link>
      <div className="mt-3 flex flex-1 flex-col sm:mt-4">
        <Link href={href} className="no-underline">
          <h3 className="line-clamp-2 font-heading text-[15px] font-medium leading-tight text-black sm:text-[16px]">
          {product.name}
          </h3>
        </Link>
        <p className="mt-1 font-body text-[13px] font-semibold text-black">
          {formatPrice(product.price)}
        </p>
        {storeName && storeSlug && (
          <Link href={`/${storeSlug}`} className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#F5F0E9] px-3 py-1 font-body text-[11px] font-medium text-primary no-underline transition-colors hover:bg-primary hover:text-white">
            {storeLogo ? (
              <span className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full">
                <Image src={storeLogo} alt="" width={16} height={16} className="h-4 w-4 rounded-full border border-line object-cover" unoptimized />
              </span>
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">
                {storeName.charAt(0).toUpperCase()}
              </span>
            )}
            {storeName}
          </Link>
        )}
        {typeof product.stock === "number" && product.stock > 0 && product.stock <= 5 && <p className="mt-2 font-body text-[11px] text-primary">Only {product.stock} left</p>}
      </div>
    </article>
  );
}
