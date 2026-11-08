import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import Layout from '@/components/Layout';
import { fetchCategoriesWithProducts, fetchProducts, fetchShows, fetchGlobal, type Product } from '@/lib/api';
import { siteUrl } from '@/lib/site';
import { firstImage, wallOrder } from '@/lib/grid-items';
import { showStatus, showDatesLong, formatPrice } from '@/lib/display';
import { isCutout } from '@/lib/frame-pick';

export const metadata: Metadata = {
  title: 'About | Tyson Draws Stuff',
  description:
    'Tyson Draws Stuff is Kirk Brillon: original paintings, poster prints, books and merch, made in Canada.',
  alternates: {
    canonical: siteUrl(`/about`),
  },
};

// Strapi's "Original Art" category has the slug "category" (see Layout).
const ORIGINALS_SLUG = 'category';

const BLURBS: Record<string, string> = {
  books: 'Art books and sketch collections.',
  merch: 'Shirts, stickers and other things with drawings on them.',
};

// A doorway into one part of the shop: a piece from it, hung small on the wall.
function Doorway({ href, title, blurb, product }: { href: string; title: string; blurb: string; product?: Product }) {
  const img = product ? firstImage(product) : null;
  return (
    <Link href={href} className="group flex flex-col gap-4">
      <span className="salon-room grid place-items-center aspect-[4/3] px-8 py-6">
        {img && (
          <span className="lit block h-full">
            <Image
              src={img.src}
              alt=""
              width={img.width}
              height={img.height}
              sizes="(min-width: 1024px) 200px, 40vw"
              className={`block h-full w-auto max-w-full object-contain transition-transform duration-300 group-hover:-translate-y-1 ${
                isCutout(img.src)
                  ? '[filter:drop-shadow(6px_12px_10px_rgba(0,0,0,.5))]'
                  : 'shadow-[6px_12px_20px_rgba(0,0,0,.55),2px_4px_6px_rgba(0,0,0,.35)]'
              }`}
            />
          </span>
        )}
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-display text-2xl group-hover:text-primary transition-colors">{title} →</span>
        <span className="text-sm text-soft">{blurb}</span>
      </span>
    </Link>
  );
}

export default async function About() {
  const [categories, products, shows, globalSettings] = await Promise.all([
    fetchCategoriesWithProducts(),
    fetchProducts(),
    fetchShows(),
    fetchGlobal(),
  ]);

  const ordered = products.slice().sort(wallOrder);
  const pick = (test: (p: Product) => boolean) => ordered.find(p => test(p) && firstImage(p));

  const doorways = [
    {
      href: `/category/${ORIGINALS_SLUG}/`,
      title: 'Originals',
      blurb: 'One-of-a-kind paintings and drawings. Once one finds a home, it’s gone.',
      product: pick(p => p.category?.slug === ORIGINALS_SLUG),
    },
    {
      href: '/posters/',
      title: 'Posters',
      blurb: globalSettings.posterPrice
        ? `Prints of the originals, ${formatPrice(globalSettings.posterPrice)} each.`
        : 'Prints of the originals.',
      product: pick(p => !!p.hasPoster),
    },
    ...categories
      .filter(c => c.slug !== ORIGINALS_SLUG && c.slug !== 'posters')
      .map(c => ({
        href: `/category/${c.slug}/`,
        title: c.name,
        blurb: BLURBS[c.slug] || c.description?.trim() || `Everything in ${c.name}.`,
        product: pick(p => p.category?.slug === c.slug),
      })),
  ];

  // The show to point people at: one that's on now, else the next one coming up.
  const show =
    shows.find(s => showStatus(s) === 'current') ??
    shows.filter(s => showStatus(s) === 'upcoming').slice(-1)[0] ??
    null;

  return (
    <Layout categories={categories}>
      {/* Intro: the artist, hung on the wall */}
      <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-12 sm:pt-16 pb-16">
        <div className="grid gap-10 lg:gap-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] items-center">
          <div className="flex flex-col gap-6 max-w-[62ch]">
            <p className="eyebrow">About</p>
            <h1 className="font-display text-4xl sm:text-[56px] leading-[1.05]">Hi, I’m Kirk. I draw stuff.</h1>
            <p className="text-lg text-soft leading-relaxed">
              Tyson Draws Stuff is me, Kirk Brillon, the artist behind everything here. What started as a passion for
              drawing has grown into a collection of original paintings, poster prints, books and merch.
            </p>
            <p className="text-soft leading-relaxed">
              My style blends humour, creativity and a touch of the unexpected. From original characters to pop culture
              reimagined, each piece tells a story and is meant to make you smile.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
              <Link
                href={`/category/${ORIGINALS_SLUG}/`}
                className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded hover:bg-[#F4B868] transition-colors"
              >
                See the originals
              </Link>
              <a
                href="mailto:kirkbrillon@gmail.com"
                className="font-semibold border-b-2 border-primary pb-0.5 hover:text-primary"
              >
                Say hello
              </a>
            </div>
          </div>

          <div className="salon-room grid place-items-center px-10 py-14 sm:py-16">
            <span className="lit block">
              <span className="painting painting-fit frame-thin_gold relative block">
                <Image
                  src="/images/about.jpg"
                  alt="Kirk Brillon, the artist, as a felt puppet"
                  width={360}
                  height={480}
                  priority
                  sizes="(min-width: 1024px) 300px, 70vw"
                  className="block w-auto h-auto max-w-full max-h-[420px]"
                />
                <span aria-hidden="true" className="painting-light" />
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* What's here */}
      <section aria-labelledby="whats-here" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-16">
          <h2 id="whats-here" className="font-display text-3xl sm:text-4xl mb-10">What you’ll find here</h2>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {doorways.map(d => (
              <Doorway key={d.href} {...d} />
            ))}
          </div>
        </div>
      </section>

      {/* The practical bits */}
      <section aria-labelledby="good-to-know" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-16 grid gap-12 lg:grid-cols-3">
          <div className="flex flex-col gap-3">
            <h2 id="good-to-know" className="eyebrow">Good to know</h2>
            <p className="font-display text-2xl leading-snug">Free shipping within Canada.</p>
            <p className="text-sm text-soft">
              It’s built into the price, so what you see is what you pay. I only ship within Canada for now.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="eyebrow">See it in person</p>
            {show ? (
              <>
                <Link href={`/shows/${show.slug}/`} className="font-display text-2xl leading-snug hover:text-primary transition-colors">
                  {showStatus(show) === 'current' ? 'On the wall now: ' : 'Coming up: '}
                  {show.title} →
                </Link>
                <p className="text-sm text-soft">
                  {show.location?.trim().replace(/\.$/, '')}
                  {show.location ? ' · ' : ''}
                  {showDatesLong(show)}
                </p>
              </>
            ) : (
              <>
                <Link href="/shows/" className="font-display text-2xl leading-snug hover:text-primary transition-colors">
                  Gallery shows →
                </Link>
                <p className="text-sm text-soft">Paintings look different on a real wall. Here’s where they’ve hung.</p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <p className="eyebrow">Get in touch</p>
            <p className="font-display text-2xl leading-snug">Questions, or something custom in mind?</p>
            <p className="text-sm text-soft">
              Email{' '}
              <a href="mailto:kirkbrillon@gmail.com" className="text-foreground font-semibold border-b border-primary hover:text-primary">
                kirkbrillon@gmail.com
              </a>
              , or follow along on{' '}
              <a
                href="https://www.instagram.com/tyson_draws_stuff/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-semibold border-b border-primary hover:text-primary"
              >
                Instagram
              </a>{' '}
              and{' '}
              <a
                href="https://www.facebook.com/tysondrawsstuff"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-semibold border-b border-primary hover:text-primary"
              >
                Facebook
              </a>{' '}
              for new work.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
