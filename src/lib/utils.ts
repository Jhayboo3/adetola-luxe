
export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatPrice(price: number): string {
  return `₦${price.toLocaleString("en-US")}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function parseJsonArray(value: string): string[] {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

const colorNames: Record<string, string> = {
  "#005c29": "Green",
  "#000000": "Black",
  "#d4af37": "Gold",
  "#ffffff": "White",
};

export function displayColor(color: string): string {
  return colorNames[color.toLowerCase()] ?? color;
}
