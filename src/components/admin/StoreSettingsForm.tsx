"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import Button from "@/components/ui/Button";
import { removeStoreLogo, updateStoreLogo } from "@/app/admin/(store)/store/actions";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export default function StoreSettingsForm({ storeName, currentLogo }: { storeName: string; currentLogo: string | null }) {
  const [state, formAction, pending] = useActionState(updateStoreLogo, {});
  const [removeState, removeAction, removePending] = useActionState(removeStoreLogo, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const previewSrc = preview ?? currentLogo;

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setValidationError(null);
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      setValidationError("Unsupported file format — please use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setValidationError("Image too large — please upload an image smaller than 2 MB.");
      return;
    }
    setValidationError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  return (
    <div className="max-w-xl">
      {(state.error || removeState.error) && <p className="border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700">{state.error || removeState.error}</p>}
      {(state.success || removeState.success) && <p className="border border-green-200 bg-green-50 p-4 font-body text-[13px] text-green-800">{state.success || removeState.success}</p>}

      <div className="mt-6 rounded-[24px] border border-line bg-white p-6">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 shrink-0">
            {previewSrc ? (
              <Image src={previewSrc} alt="Store logo preview" width={80} height={80} className="h-20 w-20 rounded-full border border-line object-cover" unoptimized />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black text-white">
                <span className="font-heading text-[28px] leading-none">{storeName.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-heading text-[18px] font-medium text-black">{storeName}</h2>
            <p className="font-body text-[12px] text-muted">This logo appears on your store cards, storefront and products.</p>
          </div>
        </div>

        <form action={formAction} className="mt-6">
          <label htmlFor="logoInput" className="font-body text-[12px] font-medium text-muted">Upload a logo (JPG, PNG or WebP · max 2 MB)</label>
          <input
            id="logoInput"
            name="logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFileChange}
            className="mt-2 max-w-full cursor-pointer rounded-xl border border-line bg-white p-2 font-body text-[12px] text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-body file:text-[11px] file:font-semibold file:uppercase file:tracking-[1px] file:text-black hover:file:bg-primary hover:file:text-white"
          />
          {validationError && (
            <p className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-body text-[12px] text-red-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">!</span>
              {validationError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="submit" disabled={pending || !preview || Boolean(validationError)}>
              {pending ? "Saving..." : preview ? "Save Logo" : "Replace Logo"}
            </Button>
          </div>
        </form>

        {currentLogo && (
          <form action={removeAction} className="mt-4 border-t border-line pt-4">
            <Button type="submit" variant="ghost" className="text-red-700" disabled={removePending}>
              {removePending ? "Removing..." : "Remove Logo"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
