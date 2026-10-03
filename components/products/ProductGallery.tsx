"use client";

import Image from "next/image";
import { useState } from "react";

export interface GalleryImage {
  src: string;
  alt: string;
}

/**
 * Product image gallery: primary image + thumbnail strip when several
 * images exist. Thumbnails are real buttons (keyboard accessible) with
 * aria-pressed; secondary images lazy-load.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];
  if (!current) return null;

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-brand-50">
        <Image
          key={current.src}
          src={current.src}
          alt={current.alt}
          width={800}
          height={600}
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      {images.length > 1 ? (
        <ul
          aria-label={`More photos of ${productName}`}
          className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5"
        >
          {images.map((img, i) => {
            const active = i === index;
            return (
              <li key={img.src}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-pressed={active}
                  aria-label={`View photo ${i + 1} of ${images.length}`}
                  className={`block w-full cursor-pointer overflow-hidden rounded-md border-2 bg-brand-50 ${
                    active ? "border-brand-700" : "border-transparent hover:border-zinc-300"
                  }`}
                >
                  <Image
                    src={img.src}
                    alt=""
                    width={160}
                    height={120}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
