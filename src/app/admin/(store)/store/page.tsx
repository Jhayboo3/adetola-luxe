import { connection } from "next/server";
import { requireStore } from "@/lib/store";
import StoreSettingsForm from "@/components/admin/StoreSettingsForm";

export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  await connection();
  const store = await requireStore();
  return (
    <div className="min-w-0">
      <div className="mb-8">
        <h1 className="font-heading text-[24px] font-medium text-black">Store Settings</h1>
        <p className="mt-1 font-body text-[13px] text-muted">Manage your store’s branding and identity</p>
      </div>
      <div className="mb-8">
        <h2 className="font-heading text-[18px] font-medium text-black">Store Logo</h2>
        <p className="mt-1 font-body text-[13px] text-muted">
          Upload a circular logo for <strong>{store.name}</strong>. It will be shown on your store cards, storefront and
          product listings across the marketplace.
        </p>
      </div>
      <StoreSettingsForm storeName={store.name} currentLogo={store.logo} />
    </div>
  );
}
