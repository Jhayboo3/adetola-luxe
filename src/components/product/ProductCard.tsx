import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    slug: string;
    images?: string[];
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col no-underline"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[20px] bg-line shadow-[0_8px_28px_rgba(15,42,34,0.07)] md:rounded-[26px]">
        {product.images?.[0] ? (
          <Image src={product.images[0]} alt={product.name} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" unoptimized />
        ) : <div className="flex h-full w-full items-center justify-center bg-[#E5DDD3] transition-transform duration-500 group-hover:scale-[1.03]">
          <span className="font-body text-[11px] uppercase tracking-[2px] text-muted">
            Image
          </span>
        </div>}
      </div>
      <div className="mt-4 space-y-1">
        <h3 className="font-heading text-[16px] font-medium text-black">
          {product.name}
        </h3>
        <p className="font-body text-[13px] text-muted">
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  );
}
