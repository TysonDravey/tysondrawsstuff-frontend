import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import OriginalsGrid, { type GridItem } from '@/components/home/OriginalsGrid';
import FeaturedHero, { type HeroSlide } from '@/components/home/FeaturedHero';
import {
  fetchProducts,
  fetchCategoriesWithProducts,
  fetchShows,
  fetchGlobal,
  type Product,
} from '@/lib/api';
import { siteUrl } from '@/lib/site';
import { displayTitle, pullQuote, isOriginal, isAvailable, formatPrice, currentShows, showDates, activeShow } from '@/lib/display';
import { firstImage, toGridItem, wallOrder } from '@/lib/grid-items';

export const metadata: Metadata = {
  alternates: {
    canonical: siteUrl(),
  },
};

export default async function Home() {
  const [products, categories, shows, global] = await Promise.all([
    fetchProducts(),
    fetchCategoriesWithProducts(),
    fetchShows(),
    fetchGlobal(),
  ]);
  const posterPrice = global.posterPrice;

  const originals = products.filter(isOriginal);
  // Hero: every featured original that is still for sale and has a picture (up to 6), as a carousel.
  // If nothing is featured, fall back to the newest available painting.
  let heroProducts = originals.filter(p => p.featured && isAvailable(p) && firstImage(p)).slice(0, 6);
  if (heroProducts.length === 0) {
    const fallback = originals.find(p => isAvailable(p) && firstImage(p));
    heroProducts = fallback ? [fallback] : [];
  }
  const heroSlides: HeroSlide[] = heroProducts.map(p => {
    const show = activeShow(p);
    const showPrice = show && p.showPrice ? p.showPrice : null;
    return {
      slug: p.slug,
      title: displayTitle(p.title),
      quote: pullQuote(p.description),
      price: formatPrice(showPrice ?? p.price),
      onlinePrice: showPrice ? formatPrice(p.price) : undefined,
      show: show
        ? { title: show.title, slug: show.slug, until: showDates(show).split(' – ')[1] }
        : undefined,
      image: firstImage(p)!,
    };
  });
  const heroIds = new Set(heroProducts.map(p => p.id));

  const liveShows = currentShows(shows);

  // Grid: every original, available pieces first, featured pieces first within that.
  const gridItems: GridItem[] = originals.slice().sort(wallOrder).map(toGridItem);

  // Posters band: one sold piece (the "missed it?" pitch) and one available piece, both with posters.
  const posterPicks = [
    originals.find(p => p.hasPoster && !isAvailable(p) && firstImage(p)),
    originals.find(p => p.hasPoster && isAvailable(p) && !heroIds.has(p.id) && firstImage(p)),
  ].filter((p): p is Product => !!p);

  return (
    <Layout categories={categories}>
      {/* Hero: featured paintings, shown whole, one at a time */}
      {heroSlides.length > 0 && <FeaturedHero slides={heroSlides} />}

      {/* Shows on right now: one row per show, however many overlap */}
      {liveShows.length > 0 && (
        <section className="bg-burgundy" aria-labelledby="on-now">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 py-6 flex flex-col">
            <h2 id="on-now" className="font-sans text-xs font-bold tracking-[0.18em] uppercase text-[#F6C9A0] pb-2">
              On the wall now{liveShows.length > 1 ? ` · ${liveShows.length} shows` : ''}
            </h2>
            <ul className="divide-y divide-white/15">
              {liveShows.map(show => (
                <li key={show.id}>
                  <Link
                    href={`/shows/${show.slug}/`}
                    className="group py-3 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 text-white"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1 min-w-0">
                      <span className="font-display text-2xl sm:text-[26px] group-hover:text-primary transition-colors">{show.title}</span>
                      <span className="text-[#F1DCCB]">
                        {show.location ? `${show.location.trim().replace(/\.$/, '')} · ` : ''}
                        Until {showDates(show).split(' – ')[1]}
                      </span>
                    </span>
                    <span className="font-semibold border-b-2 border-primary pb-0.5 group-hover:text-primary whitespace-nowrap">
                      See the show →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Originals: hung salon-style on an oxblood wall */}
      <div className="salon-room">
        <section id="originals" className="mx-auto max-w-7xl px-4 sm:px-8 pt-20 sm:pt-24 pb-20 scroll-mt-20">
          <OriginalsGrid items={gridItems} allHref="/category/category/" posterPrice={posterPrice} />
        </section>
      </div>

      {/* Posters */}
      {posterPicks.length > 0 && (
        <section className="bg-card border-y border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 py-16 sm:py-20 flex flex-wrap items-center gap-12 lg:gap-14">
            <div className="flex-[1_1_360px] min-w-0 flex flex-col gap-[18px]">
              <p className="eyebrow">Posters</p>
              <h2 className="font-display text-3xl sm:text-[40px] leading-[1.1]">
                Missed the original? Most pieces come as a{posterPrice ? ` $${posterPrice}` : ''} poster.
              </h2>
              <p className="text-soft max-w-[46ch]">
                Even the sold ones. Every painting marked “Poster available” can be ordered as a print, on its own or alongside the original.
              </p>
              <Link href="/posters/" className="self-start bg-primary text-primary-foreground font-bold px-7 py-[15px] rounded mt-2 hover:bg-[#F4B868] transition-colors">
                Shop posters
              </Link>
            </div>
            {/* Same height side by side: each poster's share of the width follows its shape. */}
            <div className="flex-[1_1_460px] min-w-0 max-w-[520px] mx-auto flex gap-5 items-start">
              {posterPicks.map(p => {
                const img = firstImage(p)!;
                return (
                  <Link key={p.id} href={`/shop/${p.slug}/`} className="min-w-0" style={{ flex: `${img.width / img.height} 1 0` }}>
                    <Image
                      src={img.src}
                      alt={`${displayTitle(p.title)} poster`}
                      width={img.width}
                      height={img.height}
                      sizes="(min-width: 1024px) 280px, 45vw"
                      className="w-full h-auto block shadow-[0_20px_50px_rgba(0,0,0,.5)]"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* The artist */}
      <section className="mx-auto max-w-[1100px] px-4 sm:px-8 py-20 sm:py-[104px] flex flex-wrap items-center gap-10 sm:gap-14">
        <Image
          src="/images/about.jpg"
          alt="Kirk Brillon, the artist behind Tyson Draws Stuff"
          width={360}
          height={480}
          className="w-[220px] sm:w-[260px] h-auto rounded shrink-0"
        />
        <div className="flex-[1_1_380px] min-w-0 flex flex-col gap-[18px]">
          <p className="eyebrow">The artist</p>
          <h2 className="font-display text-3xl sm:text-[40px] leading-[1.1]">Humour, monsters, and a touch of the unexpected.</h2>
          <p className="text-soft text-lg max-w-[52ch]">
            I’m Kirk Brillon, the hands behind Tyson Draws Stuff. What started as a love of drawing turned into a collection of original paintings, posters and odd little merch, each one telling a story and, hopefully, making you smile.
          </p>
          <Link href="/about/" className="self-start font-semibold text-foreground border-b-2 border-primary pb-0.5 hover:text-primary">
            More about the work →
          </Link>
        </div>
      </section>

      {/* Trust row */}
      <section className="border-t border-border">
        <ul className="mx-auto max-w-7xl px-4 sm:px-8 py-9 grid gap-6 sm:grid-cols-3 text-sm text-soft">
          <li className="flex gap-3 items-center">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E89B3B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 6.9L12 17.6 5.7 21l1.5-6.9L2 9.3l7-.8z"/></svg>
            Every original is one of a kind and sells once
          </li>
          <li className="flex gap-3 items-center">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E89B3B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Secure checkout with Stripe
          </li>
          <li className="flex gap-3 items-center">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E89B3B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>
            Free shipping within Canada
          </li>
        </ul>
      </section>
    </Layout>
  );
}
