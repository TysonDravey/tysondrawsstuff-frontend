import Link from 'next/link';
import type { Metadata } from 'next';
import Image from 'next/image';
import Layout from '@/components/Layout';
import { fetchShows, fetchCategoriesWithProducts, fetchProducts, type Show, type Product } from '@/lib/api';
import { getStaticAssetUrl } from '@/lib/images';
import { siteUrl } from '@/lib/site';
import { showStatus, showDatesLong, showDates, plainExcerpt } from '@/lib/display';

export const metadata: Metadata = {
  title: 'Shows | Tyson Draws Stuff',
  description: 'Where to see Tyson Draws Stuff originals in person: current, upcoming and past gallery shows.',
  alternates: {
    canonical: siteUrl(`/shows`),
  },
};

const venue = (show: Show) => show.location?.trim().replace(/\.$/, '') || null;

function piecesAt(show: Show, products: Product[]): number {
  return products.filter(p => p.currentShow?.slug === show.slug || p.shows?.some(s => s.slug === show.slug)).length;
}

// Big card for a show that's on now or coming up: poster on the left, details on the right.
function FeatureCard({ show, pieces, status }: { show: Show; pieces: number; status: 'current' | 'upcoming' }) {
  const excerpt = plainExcerpt(show.description, 200);
  const [, until] = showDates(show).split(' – ');
  const [from] = showDates(show).split(' – ');
  return (
    <Link
      href={`/shows/${show.slug}/`}
      className="group grid sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] gap-6 sm:gap-8 items-start rounded border border-border bg-card p-5 sm:p-6 hover:border-line-strong transition-colors"
    >
      <div className="salon-room grid place-items-center p-5 aspect-[4/5]">
        {show.logo ? (
          <Image
            src={getStaticAssetUrl(show.logo.url)}
            alt={show.logo.alternativeText || `${show.title} poster`}
            width={show.logo.width || 800}
            height={show.logo.height || 1000}
            sizes="220px"
            className="max-h-full w-auto h-auto max-w-full shadow-[8px_14px_24px_rgba(0,0,0,.55)]"
          />
        ) : (
          <span className="font-display text-2xl text-center">{show.title}</span>
        )}
      </div>
      <div className="flex flex-col gap-3 min-w-0">
        <span
          className={`self-start inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
            status === 'current' ? 'bg-burgundy text-[#F6C9A0]' : 'bg-white/10 text-soft'
          }`}
        >
          <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${status === 'current' ? 'bg-primary' : 'bg-soft'}`} />
          {status === 'current' ? `On now · until ${until}` : `Opens ${from}`}
        </span>
        <h3 className="font-display text-3xl leading-tight group-hover:text-primary transition-colors">{show.title}</h3>
        <p className="text-soft">
          {venue(show) && <>{venue(show)}<span aria-hidden="true"> · </span></>}
          {showDatesLong(show)}
        </p>
        {excerpt && <p className="text-sm text-muted-foreground">{excerpt}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {pieces > 0 && (
            <span className="text-soft">{pieces} piece{pieces === 1 ? '' : 's'} on the wall</span>
          )}
          <span className="font-semibold border-b-2 border-primary pb-0.5 group-hover:text-primary">See the show →</span>
        </p>
      </div>
    </Link>
  );
}

export default async function ShowsPage() {
  const [shows, categories, products] = await Promise.all([
    fetchShows(),
    fetchCategoriesWithProducts(),
    fetchProducts(),
  ]);

  const current = shows.filter(s => showStatus(s) === 'current');
  const upcoming = shows.filter(s => showStatus(s) === 'upcoming').reverse(); // soonest first
  const past = shows.filter(s => showStatus(s) === 'past'); // newest first

  return (
    <Layout categories={categories}>
      <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-12 sm:pt-16 pb-20">
        <header className="max-w-3xl flex flex-col gap-4 mb-12">
          <p className="eyebrow">Shows &amp; exhibitions</p>
          <h1 className="font-display text-4xl sm:text-[56px] leading-[1.05]">See the work in person</h1>
          <p className="text-lg text-soft">
            Paintings look different on a real wall. Here’s where they’re hanging now, what’s coming up, and where they’ve been.
            Pieces at a show are sold there, often at a show price.
          </p>
        </header>

        {current.length > 0 && (
          <section aria-labelledby="on-now" className="mb-16">
            <h2 id="on-now" className="eyebrow mb-5">On the wall now</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {current.map(s => <FeatureCard key={s.id} show={s} pieces={piecesAt(s, products)} status="current" />)}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section aria-labelledby="coming-up" className="mb-16">
            <h2 id="coming-up" className="eyebrow mb-5">Coming up</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {upcoming.map(s => <FeatureCard key={s.id} show={s} pieces={piecesAt(s, products)} status="upcoming" />)}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section aria-labelledby="past" className="border-t border-border pt-12">
            <h2 id="past" className="font-display text-3xl mb-8">Past shows</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-10">
              {past.map(s => (
                <li key={s.id}>
                  <Link href={`/shows/${s.slug}/`} className="group flex flex-col gap-3">
                    <span className="relative block aspect-[4/5] bg-card overflow-hidden">
                      {s.logo ? (
                        <Image
                          src={getStaticAssetUrl(s.logo.url)}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 230px, 45vw"
                          className="object-contain p-3 opacity-85 group-hover:opacity-100 transition-opacity"
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center p-4 font-display text-xl text-center">{s.title}</span>
                      )}
                    </span>
                    <span>
                      <span className="block font-display text-lg leading-snug group-hover:text-primary transition-colors">{s.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {venue(s) ? `${venue(s)} · ` : ''}{s.startDate.slice(0, 4)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {shows.length === 0 && (
          <p className="text-soft py-16 text-center">No shows listed yet. Check back soon.</p>
        )}
      </div>
    </Layout>
  );
}
