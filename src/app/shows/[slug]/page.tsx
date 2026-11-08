import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { marked } from 'marked';
import Layout from '@/components/Layout';
import OriginalsGrid from '@/components/home/OriginalsGrid';
import {
  fetchShowBySlug,
  fetchShowSlugs,
  fetchCategoriesWithProducts,
  fetchProductsByShow,
  fetchGlobal,
} from '@/lib/api';
import { getStaticAssetUrl } from '@/lib/images';
import { siteUrl } from '@/lib/site';
import { showStatus, showDatesLong, showDates, plainExcerpt } from '@/lib/display';
import { toGridItem, wallOrder } from '@/lib/grid-items';

interface ShowPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const slugs = await fetchShowSlugs();
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: ShowPageProps): Promise<Metadata> {
  const { slug } = await params;
  const show = await fetchShowBySlug(slug);

  if (!show) {
    return {
      title: 'Show Not Found | Tyson Draws Stuff',
      description: 'This show could not be found.',
    };
  }

  const ogImage = show.logo ? getStaticAssetUrl(show.logo.url) : '/images/og-default.jpg';
  const fullTitle = `${show.title} | Tyson Draws Stuff`;
  const metaDescription =
    plainExcerpt(show.description, 150) ??
    `Original art by Tyson Draws Stuff at ${show.location || 'a gallery show'}, ${showDatesLong(show)}.`;

  return {
    title: fullTitle,
    description: metaDescription,
    openGraph: {
      title: fullTitle,
      description: metaDescription,
      type: 'article',
      url: siteUrl(`/shows/${slug}`),
      siteName: 'Tyson Draws Stuff',
      images: [{ url: ogImage, alt: show.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: metaDescription,
      images: [ogImage],
    },
    alternates: {
      canonical: siteUrl(`/shows/${slug}`),
    },
  };
}

export default async function ShowPage({ params }: ShowPageProps) {
  const { slug } = await params;
  const [show, categories, products, globalSettings] = await Promise.all([
    fetchShowBySlug(slug),
    fetchCategoriesWithProducts(),
    fetchProductsByShow(slug),
    fetchGlobal(),
  ]);

  if (!show) {
    if (process.env.NODE_ENV === 'production') {
      return (
        <Layout categories={categories}>
          <div className="mx-auto max-w-7xl px-4 py-24 text-center">
            <h1 className="font-display text-3xl mb-4">Show not available</h1>
            <p className="text-soft mb-8">This show couldn’t be loaded at the moment.</p>
            <Link href="/shows/" className="font-semibold border-b-2 border-primary pb-0.5 hover:text-primary">
              All shows
            </Link>
          </div>
        </Layout>
      );
    }
    notFound();
  }

  const status = showStatus(show);
  const venue = show.location?.trim().replace(/\.$/, '') || null;
  const [from, until] = showDates(show).split(' – ');
  const descriptionHtml = show.description
    ? (marked(show.description, { breaks: true, gfm: true }) as string)
    : null;
  const items = products.slice().sort(wallOrder).map(toGridItem);

  const statusPill = {
    current: { text: `On now · until ${until}`, cls: 'bg-burgundy text-[#F6C9A0]', dot: 'bg-primary' },
    upcoming: { text: `Opens ${from}`, cls: 'bg-white/10 text-soft', dot: 'bg-soft' },
    past: { text: `Past show · ${show.endDate.slice(0, 4)}`, cls: 'bg-white/10 text-muted-foreground', dot: 'bg-muted-foreground' },
  }[status];

  const wallHeading = { current: 'On the wall', upcoming: 'Coming to the wall', past: 'What was shown' }[status];

  return (
    <Layout categories={categories}>
      <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-6 sm:pt-8 pb-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-8">
          <Link href="/shows/" className="hover:text-primary">Shows</Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span className="text-soft">{show.title}</span>
        </nav>

        <div className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start">
          {/* Poster, hung on the wall */}
          <div className="salon-room grid place-items-center px-8 py-12 sm:px-12 sm:py-14">
            {show.logo ? (
              <span className="lit block">
                <Image
                  src={getStaticAssetUrl(show.logo.url)}
                  alt={show.logo.alternativeText || `${show.title} poster`}
                  width={show.logo.width || 800}
                  height={show.logo.height || 1000}
                  priority
                  sizes="(min-width: 1024px) 460px, 85vw"
                  className="block w-auto h-auto max-w-full max-h-[min(64vh,620px)] shadow-[10px_20px_32px_rgba(0,0,0,.55),3px_6px_10px_rgba(0,0,0,.35)]"
                />
              </span>
            ) : (
              <span className="font-display text-4xl text-center py-16">{show.title}</span>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <span className={`self-start inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${statusPill.cls}`}>
              <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${statusPill.dot}`} />
              {statusPill.text}
            </span>
            <h1 className="font-display text-4xl sm:text-[56px] leading-[1.05]">{show.title}</h1>

            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-soft">
              {venue && (
                <>
                  <dt className="eyebrow pt-1">Where</dt>
                  <dd>{venue}</dd>
                </>
              )}
              <dt className="eyebrow pt-1">When</dt>
              <dd>{showDatesLong(show)}</dd>
              {products.length > 0 && (
                <>
                  <dt className="eyebrow pt-1">Work</dt>
                  <dd>{products.length} piece{products.length === 1 ? '' : 's'} by Tyson Draws Stuff</dd>
                </>
              )}
            </dl>

            {status !== 'past' && products.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Pieces hanging here are sold at the show{products.some(p => p.showPrice) ? ', some at a special show price' : ''}.
                Can’t make it?{' '}
                <a href="mailto:kirkbrillon@gmail.com" className="text-foreground font-semibold border-b border-primary hover:text-primary">Email me</a>.
              </p>
            )}

            {show.website && (
              <a
                href={show.website}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start bg-primary text-primary-foreground font-bold px-6 py-3 rounded hover:bg-[#F4B868] transition-colors"
              >
                Visit the show’s website ↗
              </a>
            )}

            {descriptionHtml && (
              <div
                className="text-soft leading-relaxed max-w-[62ch] border-t border-border pt-6 [&_p]:mb-4 [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h4]:font-display [&_h1]:text-2xl [&_h2]:text-2xl [&_h3]:text-xl [&_h4]:text-lg [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_h4]:text-foreground [&_h1]:mb-3 [&_h2]:mb-3 [&_h3]:mb-3 [&_h4]:mb-3[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            )}
          </div>
        </div>
      </div>

      {/* The pieces from this show, on the salon wall */}
      {items.length > 0 ? (
        <div className="salon-room">
          <section className="mx-auto max-w-7xl px-4 sm:px-8 pt-16 sm:pt-20 pb-20">
            <OriginalsGrid
              items={items}
              heading={wallHeading}
              filters={false}
              posterPrice={globalSettings.posterPrice}
            />
          </section>
        </div>
      ) : (
        <p className="mx-auto max-w-7xl px-4 sm:px-8 pb-20 text-soft">
          {status === 'upcoming' ? 'The pieces for this show will be posted soon.' : 'No pieces are listed for this show.'}
        </p>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10">
        <Link href="/shows/" className="font-semibold border-b-2 border-primary pb-0.5 hover:text-primary">
          ← All shows
        </Link>
      </div>
    </Layout>
  );
}
