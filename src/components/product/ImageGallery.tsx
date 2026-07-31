"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageGalleryProps {
  images: string[];
  productName: string;
}

export default function ImageGallery({
  images,
  productName,
}: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const placeholderImages =
    images.length > 0
      ? images
      : Array.from({ length: 3 }, (_, i) => `placeholder-${i}`);

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex gap-2 md:flex-col">
        {placeholderImages.map((image, i) => (
          <button
            key={i}
            onClick={() => setSelectedIndex(i)}
            className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
              i === selectedIndex ? "border-primary" : "border-transparent"
            }`}
          >
            {images.length ? <div className="relative h-full w-full"><Image src={image} alt={`${productName} view ${i + 1}`} fill className="object-cover" unoptimized /></div> : <div className="flex h-full w-full items-center justify-center bg-line"><span className="font-body text-[9px] text-muted">{i + 1}</span></div>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden rounded-[24px] bg-line md:rounded-[32px]">
        <div className="relative flex aspect-[3/4] w-full items-center justify-center bg-[#E5DDD3]">
          {images[selectedIndex] ? <Image src={images[selectedIndex]} alt={productName} fill className="object-cover" unoptimized /> : <span className="font-body text-[11px] uppercase tracking-[2px] text-muted">{productName}</span>}
        </div>
      </div>
    </div>
  );
}
