"use client";

import { cn } from "@/lib/utils";

interface SizeSelectorProps {
  sizes: string[];
  selected: string;
  onSelect: (size: string) => void;
}

export default function SizeSelector({
  sizes,
  selected,
  onSelect,
}: SizeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {sizes.map((size) => (
        <button
          key={size}
          onClick={() => onSelect(size)}
          className={cn(
            "h-[40px] min-w-[40px] border px-4 font-body text-[13px] transition-all",
            selected === size
              ? "border-primary bg-primary text-white"
              : "border-black bg-transparent text-black hover:border-primary"
          )}
        >
          {size}
        </button>
      ))}
    </div>
  );
}
