'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

const PER_WALL = 6;

// Small, stable pseudo-random numbers per painting (from its slug), so each piece always hangs
// the same way: same tilt, same drop, same size, on every visit and every build.
function seeded(slug: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000; // 0..1
}

function hang(slug: string) {
  return {
    tilt: (seeded(slug, 1) * 2 - 1) * 1.8,          // -1.8° .. 1.8°
    drop: Math.round(seeded(slug, 2) * 56),          // 0 .. 56px lower than the row's top
    scale: 0.82 + seeded(slug, 3) * 0.18,            // 82% .. 100% of its slot
    align: (['start', 'center', 'end'] as const)[Math.floor(seeded(slug, 4) * 3)],
  };
}

// "#originals-3" ↔ wall 3. Lets Back/Forward and shared links land on the same wall.
const wallFromHash = () => {
  const m = typeof window !== 'undefined' ? window.location.hash.match(/^#originals-(\d+)$/) : null;
  return m ? Math.max(0, Number(m[1]) - 1) : 0;
};

// The salon wall: a few paintings at a time, hung at their real proportions with slight, hand-hung
// tilts and staggered heights. Previous/Next rehangs the wall in place (no page reload, no jump).
export default function OriginalsGrid({ items, allHref, posterPrice }: {
  items: GridItem[];
  allHref: string;
  posterPrice?: number;
}) {
  const [filter, setFilter] = useState<FilterId>('available');
  const [wall, setWall] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  const active = FILTERS.find(f => f.id === filter)!;
  const matching = items.filter(active.test);
  const wallCount = Math.max(1, Math.ceil(matching.length / PER_WALL));
  const current = Math.min(wall, wallCount - 1);
  const shown = matching.slice(current * PER_WALL, current * PER_WALL + PER_WALL);

  // Open on the wall named in the address (#originals-3), and follow Back/Forward.
  useEffect(() => {
    const sync = () => setWall(wallFromHash());
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const goTo = useCallback((next: number) => {
    setWall(next);
    const hash = next === 0 ? '#originals' : `#originals-${next + 1}`;
    window.history.pushState(null, '', hash);
    // Keep the wall in view: if its top has scrolled above the screen, bring the heading back.
    const top = sectionRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      sectionRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }, []);

  const pickFilter = (id: FilterId) => {
    setFilter(id);
    if (current !== 0) goTo(0);
  };

  return (
    <div ref={sectionRef} className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <h2 className="font-display text-4xl sm:text-[44px] leading-tight">Originals</h2>
        <div role="group" aria-label="Filter originals" className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => pickFilter(f.id)}
              className={`min-h-11 px-[18px] rounded-full border text-sm font-semibold transition-colors ${
                filter === f.id
                  ? 'border-primary bg-[#2A1A10] text-foreground'
                  : 'border-white/25 text-[#E8D6C6] hover:text-foreground hover:border-white/50'
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
        // Rows share a height and each painting's slot is as wide as its shape needs (flex-grow ∝
        // aspect ratio). Inside its slot each piece is then hung a little smaller, lower and tilted.
        // The key makes React remount the wall on every change, which replays the "hang" animation.
        <div
          key={`${filter}-${current}`}
          className="salon flex flex-wrap items-start gap-x-6 sm:gap-x-10 gap-y-10 sm:gap-y-14 min-h-[420px]"
          aria-live="polite"
          aria-label={`Wall ${current + 1} of ${wallCount}`}
        >
          {shown.map((item, i) => {
            const ratio = item.image ? item.image.width / item.image.height : 0.75;
            const h = hang(item.slug);
            return (
              <div
                key={item.slug}
                className="min-w-0 flex"
                style={{
                  flexGrow: ratio,
                  flexBasis: `calc(var(--row-h) * ${ratio.toFixed(4)})`,
                  paddingTop: `${h.drop}px`,
                  justifyContent: h.align,
                }}
              >
                <Link
                  href={`/shop/${item.slug}/`}
                  className="hang-item group block text-foreground"
                  style={{
                    width: `${(h.scale * 100).toFixed(1)}%`,
                    ['--tilt' as string]: `${h.tilt.toFixed(2)}deg`,
                    ['--delay' as string]: `${i * 70}ms`,
                  }}
                >
                  <div
                    className="painting relative w-full bg-card transition-transform duration-300 group-hover:-translate-y-1"
                    style={{ aspectRatio: `${ratio}` }}
                  >
                    {item.image && (
                      <Image
                        src={item.image.src}
                        alt={item.image.alt}
                        fill
                        sizes={`(min-width: 768px) ${Math.round(440 * ratio)}px, ${Math.round(Math.min(100, 60 * ratio))}vw`}
                        className={`object-cover ${item.sold ? 'opacity-55' : ''}`}
                      />
                    )}
                    <span aria-hidden="true" className="painting-light" />
                  </div>
                  <div className="pt-3.5 flex items-baseline justify-between gap-3">
                    <span className="font-display text-[17px] sm:text-lg leading-snug group-hover:text-primary transition-colors">
                      {item.title}
                    </span>
                    <span className={`text-[15px] font-semibold whitespace-nowrap ${item.sold ? 'text-muted-foreground' : ''}`}>
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
              </div>
            );
          })}
          <span aria-hidden="true" className="grow-[1000] basis-0" />
        </div>
      )}

      <nav aria-label="Walls" className="mt-12 flex flex-wrap items-center justify-center gap-4">
        {wallCount > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="min-h-12 px-7 rounded-full border border-white/30 font-semibold uppercase tracking-[0.08em] text-sm text-foreground hover:border-primary disabled:opacity-35 disabled:hover:border-white/30 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground tabular-nums min-w-[4.5rem] text-center">
              {current + 1} / {wallCount}
            </span>
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              disabled={current >= wallCount - 1}
              className="min-h-12 px-7 rounded-full bg-primary text-primary-foreground font-bold uppercase tracking-[0.08em] text-sm hover:bg-[#F4B868] disabled:opacity-35 disabled:hover:bg-primary transition-colors"
            >
              Next
            </button>
          </>
        )}
        <Link
          href={allHref}
          className="basis-full text-center text-sm font-semibold text-muted-foreground hover:text-primary mt-2"
        >
          See all {items.length} originals on one page →
        </Link>
      </nav>
    </div>
  );
}
