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
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[76px_minmax(0,1fr)]">
      <div className="min-w-0 overflow-x-auto overscroll-contain pb-2 md:max-h-[min(75vh,820px)] md:overflow-x-hidden md:overflow-y-auto md:pb-0 md:pr-2" aria-label={`${productName} image thumbnails`}>
        <div className="flex w-max gap-3 md:w-full md:flex-col">
          {placeholderImages.map((image, i) => (
            <button
              type="button"
              key={`${image}-${i}`}
              onClick={() => setSelectedIndex(i)}
              aria-label={`View ${productName} image ${i + 1} of ${placeholderImages.length}`}
              aria-pressed={i === selectedIndex}
              className={`relative h-16 w-16 flex-none overflow-hidden rounded-xl border-2 bg-[#E5DDD3] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold md:h-[68px] md:w-[68px] ${
                i === selectedIndex ? "border-primary shadow-[0_0_0_2px_rgba(15,42,34,0.15)]" : "border-transparent hover:border-gold"
              }`}
            >
              {images.length ? <Image src={image} alt={`${productName} view ${i + 1}`} fill sizes="68px" className="object-contain" unoptimized /> : <span className="flex h-full w-full items-center justify-center bg-line font-body text-[9px] text-muted">{i + 1}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-w-0 overflow-hidden rounded-[24px] bg-line md:rounded-[32px]">
        <div className="relative flex aspect-[3/4] w-full items-center justify-center bg-[#E5DDD3]">
          {images[selectedIndex] ? <Image src={images[selectedIndex]} alt={`${productName} image ${selectedIndex + 1}`} fill sizes="(max-width: 767px) 100vw, 55vw" className="object-contain" unoptimized /> : <span className="font-body text-[11px] uppercase tracking-[2px] text-muted">{productName}</span>}
        </div>
        {images.length > 0 && <span className="absolute bottom-4 right-4 rounded-full bg-black/70 px-3 py-1.5 font-body text-[10px] font-semibold tracking-[1px] text-white" aria-live="polite">{selectedIndex + 1} / {images.length}</span>}
      </div>
    </div>
  );
}
