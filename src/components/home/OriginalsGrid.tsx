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
  frame?: string;
  image: { src: string; width: number; height: number; alt: string } | null;
}

// Frame styles drawn in globals.css (.frame-*). "auto" (the Strapi default) picks one per
// painting from its slug, so it is stable; a choice made in Strapi always wins.
const FRAMES = ['none', 'black', 'wood', 'gilt', 'ornate', 'mat'];
const AUTO_FRAMES: [string, number][] = [['black', 0.34], ['wood', 0.2], ['gilt', 0.2], ['mat', 0.14], ['ornate', 0.12]];
function frameFor(item: GridItem): string {
  if (item.frame && FRAMES.includes(item.frame)) return item.frame;
  let r = seeded(item.slug, 5);
  for (const [name, share] of AUTO_FRAMES) {
    if (r < share) return name;
    r -= share;
  }
  return 'black';
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
    scale: 0.88 + seeded(slug, 3) * 0.12,            // 88% .. 100% of its slot
    align: (['start', 'center', 'end'] as const)[Math.floor(seeded(slug, 4) * 3)],
  };
}

// Spacing and ideal row height for a given wall width (px).
function metrics(width: number) {
  if (width < 640) return { gap: 24, target: 210 };
  if (width < 1024) return { gap: 40, target: 300 };
  return { gap: 40, target: 400 };
}

// Split the paintings (in order) into rows so that every row runs the full width and the rows
// come out close to the ideal height. Tries every split (fine for a handful of pieces) and keeps
// the one with the least total squared difference from the ideal. A row that would come out far
// too tall (e.g. one lone portrait) is capped and centred instead of blown up. Rows that come out
// short count double: small paintings in a long thin strip look worse than big ones.
function planRows(ratios: number[], width: number) {
  const { gap, target } = metrics(width);
  const n = ratios.length;
  const best: number[] = [0];
  const from: number[] = [0];
  for (let i = 1; i <= n; i++) {
    best[i] = Infinity;
    for (let j = 0; j < i; j++) {
      let sum = 0;
      for (let k = j; k < i; k++) sum += ratios[k];
      const h = (width - gap * (i - j - 1)) / sum;
      const off = h < target ? (target - h) * 2 : h - target;
      const cost = best[j] + off * off;
      if (cost < best[i]) { best[i] = cost; from[i] = j; }
    }
  }
  const rows: { start: number; end: number; maxWidth?: number }[] = [];
  for (let i = n; i > 0; i = from[i]) rows.unshift({ start: from[i], end: i });
  const maxH = target * 1.35;
  for (const r of rows) {
    let sum = 0;
    for (let k = r.start; k < r.end; k++) sum += ratios[k];
    const count = r.end - r.start;
    if ((width - gap * (count - 1)) / sum > maxH) r.maxWidth = Math.round(maxH * sum + gap * (count - 1));
  }
  return { rows, gap };
}

// Round arrow halfway down the side of the wall. Wide screens: in the margin beside the paintings;
// narrower screens: over the wall's edge on a dark disc so it reads on top of a painting.
function SideArrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  const prev = dir === 'prev';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={prev ? 'Previous wall' : 'Next wall'}
      className={`absolute top-1/2 -translate-y-1/2 z-10 w-12 h-12 grid place-items-center rounded-full
        bg-black/45 backdrop-blur-sm border border-white/25 text-foreground shadow-[0_6px_18px_rgba(0,0,0,.45)]
        hover:border-primary hover:text-primary transition-[color,border-color,opacity]
        disabled:opacity-0 disabled:pointer-events-none
        ${prev ? '-left-2 2xl:-left-20' : '-right-2 2xl:-right-20'}`}
    >
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={prev ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  );
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
  // Width of the wall, measured in the browser; the static build lays out for a desktop width.
  const [wallWidth, setWallWidth] = useState(1216);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWallWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const active = FILTERS.find(f => f.id === filter)!;
  const matching = items.filter(active.test);
  const wallCount = Math.max(1, Math.ceil(matching.length / PER_WALL));
  const current = Math.min(wall, wallCount - 1);
  const shown = matching.slice(current * PER_WALL, current * PER_WALL + PER_WALL);
  const ratioOf = (item: GridItem) => (item.image ? item.image.width / item.image.height : 0.75);
  const plan = planRows(shown.map(ratioOf), wallWidth);
  const wallKey = `${filter}-${current}`;
  const layoutKey = `${wallKey}:${plan.rows.map(r => r.end).join(',')}`;

  // Paintings fade up and settle onto the wall as they scroll into view. Once a piece has been
  // revealed on this wall it stays put (no replay when a resize reshuffles the rows).
  const wallRef = useRef<HTMLDivElement>(null);
  const revealed = useRef<{ wall: string; slugs: Set<string> }>({ wall: '', slugs: new Set() });
  useEffect(() => {
    const el = wallRef.current;
    if (!el) return;
    if (revealed.current.wall !== wallKey) revealed.current = { wall: wallKey, slugs: new Set() };
    const seen = revealed.current.slugs;
    el.dataset.reveal = '1';
    const pieces = Array.from(el.querySelectorAll<HTMLElement>('.hang-item'));
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const piece = e.target as HTMLElement;
        piece.classList.add('in');
        seen.add(piece.dataset.slug ?? '');
        io.unobserve(piece);
      }
    }, { rootMargin: '0px 0px -12% 0px' });
    for (const p of pieces) {
      if (seen.has(p.dataset.slug ?? '')) p.classList.add('in', 'settled');
      else io.observe(p);
    }
    return () => io.disconnect();
  }, [layoutKey, wallKey]);

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

      <div className="relative">
      {wallCount > 1 && (
        <>
          <SideArrow dir="prev" disabled={current === 0} onClick={() => goTo(current - 1)} />
          <SideArrow dir="next" disabled={current >= wallCount - 1} onClick={() => goTo(current + 1)} />
        </>
      )}
      {shown.length === 0 ? (
        <p className="text-soft py-12">Nothing here right now. Try “All work”.</p>
      ) : (
        // Rows are planned to run edge to edge (see planRows); within a row each painting's slot is
        // as wide as its shape needs (flex-grow ∝ aspect ratio). Inside its slot each piece is then
        // hung a little smaller, lower and tilted. The key remounts the wall on every change, which
        // replays the "hang" animation.
        <div
          key={wallKey}
          ref={wallRef}
          className="salon flex flex-col gap-y-10 sm:gap-y-14 min-h-[420px]"
          aria-live="polite"
          aria-label={`Wall ${current + 1} of ${wallCount}`}
        >
          {plan.rows.map(row => (
          <div
            key={row.start}
            className="flex items-start w-full mx-auto"
            style={{ columnGap: `${plan.gap}px`, maxWidth: row.maxWidth ? `${row.maxWidth}px` : undefined }}
          >
          {shown.slice(row.start, row.end).map((item, k) => {
            const ratio = ratioOf(item);
            const h = hang(item.slug);
            // The outer pieces sit against the row's edges so the wall looks full; inner ones wander.
            const last = row.end - row.start - 1;
            const align = k === 0 ? 'start' : k === last ? 'end' : h.align;
            return (
              <div
                key={item.slug}
                className="min-w-0 flex"
                style={{
                  flex: `${ratio.toFixed(4)} 1 0`,
                  paddingTop: `${h.drop}px`,
                  justifyContent: align,
                }}
              >
                <Link
                  href={`/shop/${item.slug}/`}
                  data-slug={item.slug}
                  className="hang-item group block text-foreground"
                  style={{
                    width: `${(h.scale * 100).toFixed(1)}%`,
                    ['--tilt' as string]: `${h.tilt.toFixed(2)}deg`,
                    ['--delay' as string]: `${k * 110}ms`,
                  }}
                >
                  <div
                    className={`painting frame-${frameFor(item)} relative bg-card transition-transform duration-300 group-hover:-translate-y-1`}
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
          </div>
          ))}
        </div>
      )}
      </div>

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
