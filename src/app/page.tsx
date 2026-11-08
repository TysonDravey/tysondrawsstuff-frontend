import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import OriginalsGrid, { type GridItem } from '@/components/home/OriginalsGrid';
import {
  fetchProducts,
  fetchCategoriesWithProducts,
  fetchShows,
  fetchGlobal,
  type Product,
} from '@/lib/api';
import { getProductImages } from '@/lib/images';
import { siteUrl } from '@/lib/site';
import { displayTitle, pullQuote, isOriginal, isAvailable, formatPrice, currentShow, showDates } from '@/lib/display';

export const metadata: Metadata = {
  alternates: {
    canonical: siteUrl(),
  },
};

function firstImage(product: Product) {
  const img = getProductImages(product.slug, product.images)[0];
  if (!img) return null;
  return {
    src: img.src,
    width: img.width || 1200,
    height: img.height || 1600,
    alt: img.alt || displayTitle(product.title),
  };
}

export default async function Home() {
  const [products, categories, shows, global] = await Promise.all([
    fetchProducts(),
    fetchCategoriesWithProducts(),
    fetchShows(),
    fetchGlobal(),
  ]);
  const posterPrice = global.posterPrice;

  const originals = products.filter(isOriginal);
  // Hero: the first featured original that is still for sale and has a picture.
  const hero =
    originals.find(p => p.featured && isAvailable(p) && firstImage(p)) ??
    originals.find(p => isAvailable(p) && firstImage(p)) ??
    null;
  const heroImage = hero ? firstImage(hero) : null;
  const heroQuote = hero ? pullQuote(hero.description) : null;

  const show = currentShow(shows);

  // Grid: everything except the hero, available pieces first, featured pieces first within that.
  const gridItems: GridItem[] = originals
    .filter(p => p.id !== hero?.id)
    .sort((a, b) => Number(!isAvailable(a)) - Number(!isAvailable(b)) || Number(b.featured) - Number(a.featured))
    .map(p => ({
      slug: p.slug,
      title: displayTitle(p.title),
      price: p.price,
      sold: !isAvailable(p),
      hasPoster: !!p.hasPoster,
      image: firstImage(p),
    }));

  // Posters band: one sold piece (the "missed it?" pitch) and one available piece, both with posters.
  const posterPicks = [
    originals.find(p => p.hasPoster && !isAvailable(p) && firstImage(p)),
    originals.find(p => p.hasPoster && isAvailable(p) && p.id !== hero?.id && firstImage(p)),
  ].filter((p): p is Product => !!p);

  return (
    <Layout categories={categories}>
      {/* Hero: one painting, shown whole */}
      {hero && heroImage && (
        <section className="mx-auto max-w-7xl px-4 sm:px-8 pt-12 pb-16 sm:pt-[72px] sm:pb-[88px] flex flex-wrap-reverse items-center gap-10 lg:gap-16">
          <div className="flex-[1_1_380px] min-w-0 flex flex-col gap-6">
            <p className="eyebrow">{hero.featured ? 'Featured original' : 'Original painting'} · One of a kind</p>
            <h1 className="font-display text-[44px] sm:text-[64px] leading-[1.02]">{displayTitle(hero.title)}</h1>
            {heroQuote && <p className="text-xl text-soft italic max-w-[30ch]">“{heroQuote}”</p>}
            <div className="flex flex-wrap items-baseline gap-4">
              <span className="text-[28px] font-bold">
                {formatPrice(hero.price)} <span className="text-sm font-medium text-muted-foreground">CAD</span>
              </span>
              <span className="inline-flex items-center gap-2 text-sm text-[#CFE3B4]">
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-available" />
                Available
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              <Link href={`/shop/${hero.slug}/`} className="bg-primary text-primary-foreground font-bold px-7 py-[15px] rounded text-[15px] hover:bg-[#F4B868] transition-colors">
                See the painting
              </Link>
              <a href="#originals" className="border border-line-strong text-foreground font-semibold px-[26px] py-[14px] rounded text-[15px] hover:border-primary transition-colors">
                Browse all originals
              </a>
            </div>
          </div>
          <div className="flex-[1_1_460px] min-w-0 flex justify-center">
            <Link href={`/shop/${hero.slug}/`} className="block w-full max-w-[540px]">
              <Image
                src={heroImage.src}
                alt={heroImage.alt}
                width={heroImage.width}
                height={heroImage.height}
                priority
                sizes="(min-width: 1024px) 540px, 100vw"
                className="w-full h-auto block shadow-[0_30px_80px_rgba(0,0,0,.6)]"
              />
            </Link>
          </div>
        </section>
      )}

      {/* Current show band */}
      {show && (
        <section className="bg-burgundy">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 py-7 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <span className="text-xs font-bold tracking-[0.18em] uppercase text-[#F6C9A0]">On the wall now</span>
              <span className="font-display text-2xl sm:text-[26px]">{show.title}</span>
              <span className="text-[#F1DCCB]">
                {show.location ? `${show.location.trim().replace(/\.$/, '')} · ` : ''}
                {showDates(show)}
              </span>
            </div>
            <Link href={`/shows/${show.slug}/`} className="text-white font-semibold border-b-2 border-primary pb-0.5 hover:text-primary">
              See the show →
            </Link>
          </div>
        </section>
      )}

      {/* Originals */}
      <section id="originals" className="mx-auto max-w-7xl px-4 sm:px-8 pt-20 sm:pt-24 pb-16 scroll-mt-20">
        <OriginalsGrid items={gridItems} allHref="/category/category/" posterPrice={posterPrice} />
      </section>

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
            <div className="flex-[1_1_460px] min-w-0 flex gap-5 items-end">
              {posterPicks.map((p, i) => {
                const img = firstImage(p)!;
                return (
                  <Link key={p.id} href={`/shop/${p.slug}/`} className={i === 0 ? 'w-[46%]' : 'w-[34%]'}>
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
            Ships within Canada and the US
          </li>
        </ul>
      </section>
    </Layout>
  );
}
