import { slugify } from "@/lib/utils";

export function uploadFileKey(file: { name: string; size: number }) {
  return `${file.name}:${file.size}`;
}

function filenameLabel(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "");
  return stem.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

export function separateProductIdentity(baseName: string, requestedSlug: string, filename: string, index: number, total: number, token = crypto.randomUUID()) {
  const label = filenameLabel(filename);
  const name = total > 1 && label ? `${baseName} — ${label}` : baseName;
  const baseSlug = slugify(requestedSlug || baseName) || "clothing";
  const itemSlug = total > 1 && label ? `-${slugify(label)}` : "";
  return { name, slug: `${baseSlug}${itemSlug}-${index + 1}-${token.slice(0, 8)}` };
}
