import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import { fetchProductBySlug, fetchProductSlugs, fetchCategoriesWithProducts, fetchProductsByCategory, fetchProductsByShow, fetchGlobal, type Product, type Show } from '@/lib/api';
import BuyButton from '@/components/BuyButton';
import ImageGallery from '@/components/ImageGallery';
import ProductNavigation from '@/components/ProductNavigation';
import { getProductImages } from '@/lib/images';
import { displayTitle, describeOriginal, isOriginal, formatPrice, showDates } from '@/lib/display';
import { marked } from 'marked';
import { siteUrl } from '@/lib/site';
import { frameFor, frameSetting } from '@/lib/frame-pick';

const CONTACT_EMAIL = 'kirkbrillon@gmail.com';

// A show counts as on (and holds the piece for in-person sale) until the end of its last day.
function isShowActive(show: Show): boolean {
  return show.endDate.slice(0, 10) >= new Date().toISOString().slice(0, 10);
}

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Static export - no revalidation needed

export async function generateStaticParams() {
  const slugs = await fetchProductSlugs();

  return slugs.map((slug) => ({
    slug: slug,
  }));
}


export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return {
      title: 'Product Not Found | Tyson Draws Stuff',
      description: 'This product could not be found.',
    };
  }

  // Get product images and use first one for OG image
  const productImages = getProductImages(slug, product.images || []);
  const firstImage = productImages[0];

  // Truncate description to ~150 characters for meta description
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
  const metaDescription = product.description
    ? stripHtml(product.description).substring(0, 150).trim() + (product.description.length > 150 ? '...' : '')
    : `Original artwork by Tyson Brillon - ${product.title}. Available for purchase.`;

  const ogImage = firstImage?.src || '/images/og-default.jpg';
  const fullTitle = `${product.title} | Tyson Draws Stuff`;

  return {
    title: fullTitle,
    description: metaDescription,
    openGraph: {
      title: fullTitle,
      description: metaDescription,
      type: 'article',
      url: siteUrl(`/shop/${slug}`),
      siteName: 'Tyson Draws Stuff',
      images: [
        {
          url: ogImage,
          width: firstImage?.width || 1200,
          height: firstImage?.height || 630,
          alt: product.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: metaDescription,
      images: [ogImage],
    },
    alternates: {
      canonical: siteUrl(`/shop/${slug}`),
    },
  };
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <svg aria-hidden="true" className="mt-0.5 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E89B3B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      <span>{children}</span>
    </li>
  );
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [product, categories, globalSettings] = await Promise.all([
    fetchProductBySlug(slug),
    fetchCategoriesWithProducts(),
    fetchGlobal()
  ]);

  if (!product) {
    // During build time, if Strapi is not available, show a placeholder
    if (process.env.NODE_ENV === 'production') {
      return (
        <Layout categories={categories}>
          <div className="mx-auto max-w-7xl px-4 py-24 text-center">
            <h1 className="font-display text-3xl mb-4">Not available right now</h1>
            <p className="text-soft mb-8">This piece couldn’t be loaded at the moment.</p>
            <Link href="/category/category/" className="font-semibold border-b-2 border-primary pb-0.5 hover:text-primary">
              Browse the originals
            </Link>
          </div>
        </Layout>
      );
    }
    notFound();
  }

  const title = displayTitle(product.title);
  const original = isOriginal(product);
  const sold = product.sold === true;
  const show = product.currentShow && isShowActive(product.currentShow) ? product.currentShow : null;
  const posterPrice = product.hasPoster ? globalSettings.posterPrice : undefined;

  // Originals: story ("Sometimes…") + details (medium, size, framing). Books/merch: the full text.
  const { story, details } = original ? describeOriginal(product.description) : { story: null, details: [] };
  const bodyHtml = !original && product.description
    ? (marked(product.description, { breaks: true, gfm: true }) as string)
    : null;

  // Shows this piece has been in, excluding the one it's at now
  const pastShows = (product.shows || [])
    .filter(s => !(show && s.slug === show.slug))
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  // Previous / next: within the show it's hanging at, otherwise within its category
  let related: Product[] = [];
  if (show) related = await fetchProductsByShow(show.slug);
  else if (product.category) related = await fetchProductsByCategory(product.category.slug);
  const contextLabel = show ? show.title : product.category?.name === 'Original Art' ? 'Originals' : product.category?.name;
  const contextHref = show ? `/shows/${show.slug}/` : product.category ? `/category/${product.category.slug}/` : undefined;

  const askHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`About “${title}”`)}`;

  return (
    <Layout categories={categories}>
      <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-6 sm:pt-8 pb-20">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-6">
          {contextHref && contextLabel ? (
            <Link href={contextHref} className="hover:text-primary">{contextLabel}</Link>
          ) : (
            <Link href="/shop/" className="hover:text-primary">Shop</Link>
          )}
          <span aria-hidden="true" className="mx-2">/</span>
          <span className="text-soft">{title}</span>
        </nav>

        <div className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
          <ImageGallery
            images={product.images || []}
            productTitle={title}
            productSlug={product.slug}
            sold={original && sold}
            frame={original ? frameFor({ slug: product.slug, frame: frameSetting(product) }) : 'none'}
          />

          <div className="lg:sticky lg:top-24 flex flex-col gap-7">
            <div className="flex flex-col gap-4">
              <p className="eyebrow">
                {original ? 'Original painting · One of a kind' : product.category?.name ?? 'Shop'}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl leading-[1.05]">{title}</h1>
              {story && <p className="text-xl text-soft italic max-w-[34ch]">“{story}”</p>}
            </div>

            {/* Price and status */}
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              {original && sold ? (
                <span className="inline-flex items-center gap-2 text-lg font-semibold">
                  <span aria-hidden="true" className="w-3 h-3 rounded-full bg-[#D7262E]" />
                  Sold. This original has found its home.
                </span>
              ) : (
                <>
                  <span className="text-[32px] font-bold leading-none">
                    {formatPrice(show && product.showPrice ? product.showPrice : product.price)}{' '}
                    <span className="text-sm font-medium text-muted-foreground">CAD</span>
                  </span>
                  {show && product.showPrice ? (
                    <span className="text-sm text-muted-foreground">
                      Show price · <s>{formatPrice(product.price)}</s> online
                    </span>
                  ) : original ? (
                    <span className="inline-flex items-center gap-2 text-sm text-[#CFE3B4]">
                      <span aria-hidden="true" className="w-2 h-2 rounded-full bg-available" />
                      Available
                    </span>
                  ) : null}
                </>
              )}
            </div>

            {/* Buying */}
            {show && !sold ? (
              <div className="rounded border border-[#F6C9A0]/30 bg-burgundy/40 p-5 flex flex-col gap-3">
                <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#F6C9A0]">On the wall now</p>
                <p>
                  This original is hanging at <strong>{show.title}</strong>
                  {show.location ? `, ${show.location.trim().replace(/\.$/, '')}` : ''} until{' '}
                  {showDates(show).split(' – ')[1]}. Buy it there, or email me to reserve it.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/shows/${show.slug}/`} className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded hover:bg-[#F4B868] transition-colors">
                    See the show
                  </Link>
                  <a href={askHref} className="border border-white/30 font-semibold px-6 py-3 rounded hover:border-primary transition-colors">
                    Email to reserve
                  </a>
                </div>
              </div>
            ) : !sold || !original ? (
              <BuyButton
                productSlug={product.slug}
                price={product.price}
                productTitle={product.title}
                variant="original"
                label={original ? undefined : `Buy now · ${formatPrice(product.price)}`}
              />
            ) : null}

            {/* Poster */}
            {posterPrice ? (
              <div id="poster" className="scroll-mt-28 rounded border border-border bg-card p-5 flex flex-col gap-4">
                <div>
                  <p className="font-display text-xl">Poster print · {formatPrice(posterPrice)}</p>
                  <p className="text-sm text-soft mt-1">
                    {sold
                      ? 'The original is gone, but you can still hang this one on your wall.'
                      : 'Love it, but not the original price? Take home a print.'}
                  </p>
                </div>
                <BuyButton productSlug={product.slug} price={posterPrice} productTitle={product.title} variant="poster" />
              </div>
            ) : null}

            {/* Details */}
            {details.length > 0 && (
              <div>
                <h2 className="eyebrow mb-3">Details</h2>
                <ul className="divide-y divide-border border-y border-border">
                  {details.map(d => (
                    <li key={d} className="py-2.5 text-soft">{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {bodyHtml && (
              <div
                className="text-soft leading-relaxed [&_p]:mb-4 [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            )}

            {/* Reassurance */}
            <ul className="flex flex-col gap-2.5 text-sm text-soft">
              {original && <Tick>One of a kind. Each original sells once.</Tick>}
              <Tick>Free shipping within Canada</Tick>
              <Tick>Secure checkout with Stripe</Tick>
            </ul>
            <p className="text-sm text-muted-foreground">
              Outside Canada, or have a question?{' '}
              <a href={askHref} className="text-foreground font-semibold border-b border-primary hover:text-primary">
                Email me about this piece
              </a>
            </p>

            {/* Show history */}
            {pastShows.length > 0 && (
              <div>
                <h2 className="eyebrow mb-3">Shown at</h2>
                <ul className="flex flex-col gap-1.5">
                  {pastShows.map(s => (
                    <li key={s.documentId}>
                      <Link href={`/shows/${s.slug}/`} className="font-semibold hover:text-primary">{s.title}</Link>
                      <span className="text-sm text-muted-foreground ml-2">{s.startDate.slice(0, 4)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="mt-16">
          <ProductNavigation currentProduct={product} allProducts={related} contextLabel={contextLabel} contextHref={contextHref} />
        </div>
      </div>
    </Layout>
  );
}
