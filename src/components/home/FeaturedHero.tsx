'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';

export interface HeroSlide {
  slug: string;
  title: string;
  quote: string | null;
  /** The price to show: the show price while the piece hangs at a show (if one is set). */
  price: string;
  /** The regular online price, when `price` is a show price. */
  onlinePrice?: string;
  /** The show the piece is hanging at right now. */
  show?: { title: string; slug: string; until: string };
  image: { src: string; width: number; height: number; alt: string };
}

// The home page hero: one featured painting at a time, shown whole. With several featured pieces it
// becomes a slow carousel (swipe, arrows, dots); it pauses on hover/focus and never moves on its own
// for people who ask for reduced motion.
export default function FeaturedHero({ slides }: { slides: HeroSlide[] }) {
  const many = slides.length > 1;
  const autoplay = useRef(Autoplay({ delay: 7000, stopOnInteraction: true, stopOnMouseEnter: true, stopOnFocusIn: true }));
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, many ? [autoplay.current] : []);
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) autoplay.current.stop();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  const go = (i: number) => emblaApi?.scrollTo(i);

  return (
    <section
      aria-roledescription={many ? 'carousel' : undefined}
      aria-label="Featured originals"
      className="relative mx-auto max-w-7xl"
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((s, i) => (
            <div
              key={s.slug}
              className="min-w-0 shrink-0 grow-0 basis-full"
              role={many ? 'group' : undefined}
              aria-roledescription={many ? 'slide' : undefined}
              aria-label={many ? `${i + 1} of ${slides.length}` : undefined}
            >
              <div className="px-4 sm:px-8 pt-12 pb-10 sm:pt-[72px] sm:pb-14 flex flex-wrap-reverse items-center gap-10 lg:gap-16">
                <div className="flex-[1_1_380px] min-w-0 flex flex-col gap-6">
                  <p className="eyebrow">Featured original · One of a kind</p>
                  {i === 0 ? (
                    <h1 className="font-display text-[44px] sm:text-[64px] leading-[1.02]">{s.title}</h1>
                  ) : (
                    <h2 className="font-display text-[44px] sm:text-[64px] leading-[1.02]">{s.title}</h2>
                  )}
                  {s.quote && <p className="text-xl text-soft italic max-w-[30ch]">“{s.quote}”</p>}
                  <div className="flex flex-wrap items-baseline gap-4">
                    <span className="text-[28px] font-bold">
                      {s.price} <span className="text-sm font-medium text-muted-foreground">CAD</span>
                    </span>
                    {s.onlinePrice && (
                      <span className="text-sm text-muted-foreground">
                        Show price · <s>{s.onlinePrice}</s> online
                      </span>
                    )}
                    {!s.show && (
                      <span className="inline-flex items-center gap-2 text-sm text-[#CFE3B4]">
                        <span aria-hidden="true" className="w-2 h-2 rounded-full bg-available" />
                        Available
                      </span>
                    )}
                  </div>
                  {s.show && (
                    <Link
                      href={`/shows/${s.show.slug}/`}
                      tabIndex={i === selected ? 0 : -1}
                      className="self-start inline-flex items-center gap-2.5 rounded-full border border-[#F6C9A0]/40 bg-burgundy/60 px-4 py-2 text-sm text-[#F6C9A0] hover:border-[#F6C9A0] transition-colors"
                    >
                      <span aria-hidden="true" className="w-2 h-2 rounded-full bg-primary" />
                      On the wall at <strong className="text-foreground">{s.show.title}</strong> until {s.show.until}
                    </Link>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2">
                    <Link
                      href={`/shop/${s.slug}/`}
                      tabIndex={i === selected ? 0 : -1}
                      className="bg-primary text-primary-foreground font-bold px-7 py-[15px] rounded text-[15px] hover:bg-[#F4B868] transition-colors"
                    >
                      See the painting
                    </Link>
                    <a
                      href="#originals"
                      tabIndex={i === selected ? 0 : -1}
                      className="border border-line-strong text-foreground font-semibold px-[26px] py-[14px] rounded text-[15px] hover:border-primary transition-colors"
                    >
                      Browse all originals
                    </a>
                  </div>
                </div>
                <div className="flex-[1_1_460px] min-w-0 flex justify-center">
                  <Link href={`/shop/${s.slug}/`} tabIndex={-1} className="block">
                    <Image
                      src={s.image.src}
                      alt={s.image.alt}
                      width={s.image.width}
                      height={s.image.height}
                      priority={i === 0}
                      sizes="(min-width: 1024px) 540px, 100vw"
                      className="w-auto h-auto max-w-full max-h-[min(72vh,640px)] block shadow-[0_30px_80px_rgba(0,0,0,.6)]"
                    />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {many && (
        <div className="px-4 sm:px-8 pb-12 sm:pb-16 flex items-center gap-4">
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            aria-label="Previous featured painting"
            className="w-11 h-11 grid place-items-center rounded-full border border-line-strong text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="flex items-center gap-1">
            {slides.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show ${s.title}`}
                aria-current={i === selected ? 'true' : undefined}
                className="w-6 h-11 grid place-items-center group"
              >
                <span className={`block h-1.5 rounded-full transition-all ${i === selected ? 'w-5 bg-primary' : 'w-1.5 bg-[#5A4A40] group-hover:bg-muted-foreground'}`} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            aria-label="Next featured painting"
            className="w-11 h-11 grid place-items-center rounded-full border border-line-strong text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <span className="ml-2 text-sm text-muted-foreground tabular-nums">
            {selected + 1} / {slides.length}
          </span>
        </div>
      )}
    </section>
  );
}
