import ProductCard from "./ProductCard";

interface Product {
  id: string;
  name: string;
  price: number;
  slug: string;
  description: string;
  stock: number;
  images?: string[];
  sizes?: string[];
  colors?: string[];
}

interface ProductGridProps {
  products: Product[];
  storeSlug?: string;
}

export default function ProductGrid({ products, storeSlug }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:gap-x-6 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} storeSlug={storeSlug} />
      ))}
    </div>
  );
}
