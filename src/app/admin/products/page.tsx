import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice, parseJsonArray } from "@/lib/utils";
import { deleteProduct } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="font-heading text-[24px] font-medium text-black">Clothing</h1><p className="mt-1 font-body text-[13px] text-muted">Upload and manage your clothing collection</p></div>
        <Link href="/admin/products/new" className="w-full bg-gold px-6 py-3 text-center font-body text-[13px] font-semibold uppercase tracking-[1px] text-black no-underline sm:w-auto">Add Clothing</Link>
      </div>
      {products.length === 0 ? (
        <div className="border border-dashed border-line px-6 py-16 text-center"><p className="font-heading text-[18px]">No clothing uploaded yet</p><p className="mt-2 font-body text-[13px] text-muted">Add your first piece to make it available in the shop.</p></div>
      ) : (
        <div className="max-w-full overflow-x-auto border border-line"><table className="min-w-[720px] w-full text-left"><thead><tr className="border-b border-line bg-black/5">
          {['Product','Price','Stock','Status','Actions'].map((title) => <th key={title} className="px-6 py-4 font-body text-[11px] font-medium uppercase tracking-[2px] text-muted">{title}</th>)}
        </tr></thead><tbody>{products.map((product) => {
          const image = parseJsonArray(product.images)[0];
          return <tr key={product.id} className="border-b border-line last:border-0">
            <td className="px-6 py-4"><div className="flex items-center gap-4">{image ? <div className="relative h-16 w-12 overflow-hidden bg-line"><Image src={image} alt="" fill className="object-cover" unoptimized /></div> : <div className="h-16 w-12 bg-line" />}<div><p className="font-heading text-[14px] font-medium text-black">{product.name}</p><p className="font-body text-[11px] text-muted">/{product.slug}</p></div></div></td>
            <td className="px-6 py-4 font-body text-[13px] text-muted">{formatPrice(product.price)}</td>
            <td className="px-6 py-4 font-body text-[13px] text-muted">{product.stock}</td>
            <td className="px-6 py-4 font-body text-[11px] uppercase tracking-[2px]">{product.published ? <span className="text-primary">Published</span> : <span className="text-muted">Draft</span>}</td>
            <td className="px-6 py-4"><div className="flex items-center gap-4"><Link href={`/admin/products/${product.id}`} className="font-body text-[11px] uppercase tracking-[2px] text-primary no-underline">Edit</Link><form action={deleteProduct}><input type="hidden" name="id" value={product.id} /><button className="font-body text-[11px] uppercase tracking-[2px] text-red-700">Delete</button></form></div></td>
          </tr>;
        })}</tbody></table></div>
      )}
    </div>
  );
}
