'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export interface GridItem {
  slug: string;
  title: string;
  price: number;
  sold: boolean;
  hasPoster: boolean;
  image: { src: string; width: number; height: number; alt: string } | null;
}

const FILTERS = [
  { id: 'available', label: 'Available', test: (i: GridItem) => !i.sold },
  { id: 'all', label: 'All work', test: () => true },
  { id: 'under400', label: 'Under $400', test: (i: GridItem) => !i.sold && i.price < 400 },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

// Paintings are shown at their own proportions (a masonry of columns), never cropped to squares.
export default function OriginalsGrid({ items, limit = 12, allHref, posterPrice }: {
  items: GridItem[];
  limit?: number;
  allHref: string;
  posterPrice?: number;
}) {
  const [filter, setFilter] = useState<FilterId>('available');
  const active = FILTERS.find(f => f.id === filter)!;
  const matching = items.filter(active.test);
  const shown = matching.slice(0, limit);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <h2 className="font-display text-4xl sm:text-[44px] leading-tight">Originals</h2>
        <div role="group" aria-label="Filter originals" className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-11 px-[18px] rounded-full border text-sm font-semibold transition-colors ${
                filter === f.id
                  ? 'border-primary bg-[#2A1A10] text-foreground'
                  : 'border-[#3A2E28] text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-soft py-12">Nothing here right now. Try “All work”.</p>
      ) : (
        <div className="columns-2 md:columns-3 xl:columns-4 gap-5 sm:gap-8">
          {shown.map(item => (
            <Link
              key={item.slug}
              href={`/shop/${item.slug}/`}
              className="group block break-inside-avoid mb-8 sm:mb-10 text-foreground"
            >
              {item.image ? (
                <Image
                  src={item.image.src}
                  alt={item.image.alt}
                  width={item.image.width}
                  height={item.image.height}
                  sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
                  className={`w-full h-auto block transition-opacity group-hover:opacity-90 ${item.sold ? 'opacity-55' : ''}`}
                />
              ) : (
                <div className="aspect-[3/4] bg-card" />
              )}
              <div className="pt-3 flex items-baseline justify-between gap-3">
                <span className="font-semibold text-[15px] group-hover:text-primary transition-colors">{item.title}</span>
                <span className={`text-[15px] whitespace-nowrap ${item.sold ? 'text-muted-foreground' : ''}`}>
                  {item.sold ? 'Sold' : `$${item.price}`}
                </span>
              </div>
              {item.hasPoster && (
                <div className="text-[13px] text-muted-foreground mt-0.5">
                  {item.sold ? 'Poster still available' : 'Poster available'}
                  {posterPrice ? ` · $${posterPrice}` : ''}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="text-center mt-4">
        <Link
          href={allHref}
          className="inline-block border border-line-strong text-foreground font-semibold px-7 py-3.5 rounded hover:border-primary transition-colors"
        >
          View all {items.length} originals
        </Link>
      </div>
    </>
  );
}
