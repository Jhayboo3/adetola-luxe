import { prisma } from "@/lib/prisma";
import { createCategory, deleteCategory } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } },
      children: { orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } },
    },
  });

  return <div><div className="mb-8"><h1 className="font-heading text-[24px] font-medium">Categories</h1><p className="mt-1 font-body text-[13px] text-muted">Organise clothing into categories and customer-facing subcategories.</p></div>
    <form action={createCategory} className="grid gap-4 border border-line p-4 sm:p-6 md:grid-cols-2"><label className="font-body text-[12px] text-muted">Category name<input name="name" required placeholder="e.g. Shirts or Long Sleeve" className="mt-2 block w-full border-b border-black p-2 font-body text-[13px] text-black" /></label><label className="font-body text-[12px] text-muted">Parent category<select name="parentId" className="mt-2 block w-full border-b border-black bg-white p-2 font-body text-[13px] text-black"><option value="">None — top-level category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="font-body text-[12px] text-muted md:col-span-2">Description<input name="description" placeholder="Optional description for shoppers" className="mt-2 block w-full border-b border-black p-2 font-body text-[13px] text-black" /></label><button className="bg-gold px-5 py-3 font-body text-[11px] font-semibold uppercase tracking-[1px] md:w-fit">Create Category</button></form>
    <div className="mt-8 space-y-5">{categories.map((category) => <section key={category.id} className="border border-line"><div className="flex flex-col justify-between gap-3 bg-black/5 p-4 sm:flex-row sm:items-center sm:p-5"><div><h2 className="font-heading text-[17px]">{category.name}</h2><p className="font-body text-[11px] text-muted">{category._count.products} direct {category._count.products === 1 ? "piece" : "pieces"} · {category.children.length} {category.children.length === 1 ? "subcategory" : "subcategories"}</p>{category.description && <p className="mt-1 font-body text-[12px] text-muted">{category.description}</p>}</div><form action={deleteCategory}><input type="hidden" name="id" value={category.id} /><button className="font-body text-[11px] uppercase text-red-700">Delete</button></form></div>
      {category.children.length > 0 && <div className="divide-y divide-line">{category.children.map((child) => <div key={child.id} className="flex items-center justify-between gap-4 p-4 pl-7 sm:pl-10"><div><p className="font-heading text-[14px]">↳ {child.name}</p><p className="font-body text-[11px] text-muted">{child._count.products} {child._count.products === 1 ? "piece" : "pieces"}{child.description ? ` · ${child.description}` : ""}</p></div><form action={deleteCategory}><input type="hidden" name="id" value={child.id} /><button className="font-body text-[11px] uppercase text-red-700">Delete</button></form></div>)}</div>}
    </section>)}{categories.length === 0 && <p className="border border-dashed border-line p-10 text-center font-body text-[13px] text-muted">No categories yet.</p>}</div>
  </div>;
}
