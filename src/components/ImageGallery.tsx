'use client';

import { useState } from 'react';
import Image from 'next/image';
import Lightbox from 'yet-another-react-lightbox';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import { StrapiImage } from '@/lib/api';
import { getProductImages } from '@/lib/images';

interface ImageGalleryProps {
  images: StrapiImage[];
  productTitle: string;
  productSlug: string;
  sold?: boolean;
}

// Product page: the piece hangs on the same oxblood wall as the home page salon, unframed (so it
// shows what actually ships), under a picture light. A sold original gets a gallery red dot.
// Click/tap to enlarge; extra photos (details, the piece in a room) are thumbnails underneath.
export default function ImageGallery({ images, productTitle, productSlug, sold = false }: ImageGalleryProps) {
  const [selected, setSelected] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const processed = getProductImages(productSlug, images);

  if (!processed || processed.length === 0) {
    return (
      <div className="salon-room aspect-[4/3] grid place-items-center text-muted-foreground">
        No photo yet
      </div>
    );
  }

  const img = processed[selected];

  return (
    <div className="flex flex-col gap-4">
      <div className="salon-room relative px-6 sm:px-12 py-12 sm:py-16 flex justify-center">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label={`Enlarge ${productTitle}`}
          className="lit group relative block cursor-zoom-in"
        >
          <span className="relative block shadow-[10px_20px_32px_rgba(0,0,0,.55),3px_6px_10px_rgba(0,0,0,.35)]">
            <Image
              src={img.src}
              alt={img.alt || `${productTitle}, image ${selected + 1}`}
              width={img.width || 1200}
              height={img.height || 1600}
              sizes="(min-width: 1024px) 680px, 92vw"
              priority={selected === 0}
              className="block w-auto h-auto max-w-full max-h-[min(70vh,720px)]"
            />
            <span aria-hidden="true" className="painting-light" />
          </span>
          {sold && (
            <span
              title="Sold"
              className="absolute -right-4 -bottom-4 w-5 h-5 rounded-full bg-[#D7262E] shadow-[2px_3px_6px_rgba(0,0,0,.5)] ring-2 ring-[#ff6a6a]/30"
            >
              <span className="sr-only">Sold</span>
            </span>
          )}
        </button>

        <span
          aria-hidden="true"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 text-xs font-semibold text-[#E8D6C6]/80"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
          Click to enlarge
        </span>
      </div>

      {processed.length > 1 && (
        <div className="flex flex-wrap gap-3" role="group" aria-label="More photos">
          {processed.map((image, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`Photo ${i + 1} of ${processed.length}`}
              aria-current={i === selected ? 'true' : undefined}
              className={`relative w-16 h-16 sm:w-20 sm:h-20 overflow-hidden rounded-sm transition ${
                i === selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Image src={image.src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={selected}
        slides={processed.map(p => ({
          src: p.src,
          alt: p.alt || productTitle,
          width: p.width,
          height: p.height,
        }))}
        on={{ view: ({ index }: { index: number }) => setSelected(index) }}
        plugins={processed.length > 1 ? [Thumbnails] : []}
        render={processed.length > 1 ? undefined : { buttonPrev: () => null, buttonNext: () => null }}
        thumbnails={{ position: 'bottom', width: 100, height: 70, border: 0, borderRadius: 2, padding: 0, gap: 12 }}
        styles={{ container: { backgroundColor: 'rgba(14, 11, 10, .97)' } }}
      />
    </div>
  );
}
