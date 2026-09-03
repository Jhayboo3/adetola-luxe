import { connection } from "next/server";
import { requireStore } from "@/lib/store";
import StoreProfileForm from "@/components/admin/StoreProfileForm";

export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  await connection();
  const store = await requireStore();
  return (
    <div className="min-w-0">
      <div className="mb-8">
        <h1 className="font-heading text-[24px] font-medium text-black">Store Settings</h1>
        <p className="mt-1 font-body text-[13px] text-muted">Manage your store’s branding, profile and public information</p>
      </div>
      <StoreProfileForm store={store} />
    </div>
  );
}
