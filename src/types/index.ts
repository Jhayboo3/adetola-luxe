export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAt: number | null;
  images: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  categoryId: string | null;
  category: Category | null;
  featured: boolean;
  published: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
  storeSlug?: string;
  storeName?: string;
}

export interface Order {
  id: string;
  email: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string | null;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number | null;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  size: string;
  price: number;
}

export interface DiscountCode {
  id: string;
  code: string;
  type: string;
  value: number;
  minOrder: number | null;
  active: boolean;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: string | null;
}
