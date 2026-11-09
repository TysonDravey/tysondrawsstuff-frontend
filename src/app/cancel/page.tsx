import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import { fetchCategoriesWithProducts, fetchProductBySlug } from '@/lib/api';
import { siteUrl } from '@/lib/site';
import { getProductImages } from '@/lib/images';
import { displayTitle, isAvailable } from '@/lib/display';
import { isCutout } from '@/lib/frame-pick';

export const metadata: Metadata = {
  title: 'Checkout cancelled | Tyson Draws Stuff',
  robots: { index: false },
  alternates: {
    canonical: siteUrl(`/cancel`),
  },
};

interface CancelPageProps {
  searchParams: Promise<{ product?: string }>;
}

// Back from Stripe without paying. Nothing was charged; offer the way back to the piece.
export default async function CancelPage({ searchParams }: CancelPageProps) {
  const { product: slug } = await searchParams;
  const [categories, product] = await Promise.all([
    fetchCategoriesWithProducts(),
    slug && /^[a-z0-9-]+$/.test(slug) ? fetchProductBySlug(slug) : Promise.resolve(null),
  ]);
  const image = product ? getProductImages(product.slug)[0] : undefined;
  const title = product ? displayTitle(product.title) : null;
  // Original still for sale, or (for a poster checkout) the print still is.
  const stillHere = product ? isAvailable(product) || !!product.hasPoster : false;

  return (
    <Layout categories={categories}>
      <div className="mx-auto max-w-3xl px-4 sm:px-8 py-20 sm:py-24 flex flex-col items-center text-center gap-6">
        {image && (
          <div className="salon-room grid place-items-center px-10 py-10 w-full max-w-sm">
            <span className="lit block">
              <span className={`painting painting-fit ${isCutout(image.src) ? 'painting-cutout' : ''} relative block`}>
                <Image
                  src={image.src}
                  alt={image.alt || title || ''}
                  width={image.width || 1200}
                  height={image.height || 1600}
                  sizes="280px"
                  className="block w-auto h-auto max-w-full max-h-[300px]"
                />
                <span aria-hidden="true" className="painting-light" />
              </span>
            </span>
          </div>
        )}
        <p className="eyebrow">Checkout cancelled</p>
        <h1 className="font-display text-4xl sm:text-5xl leading-[1.05]">No worries. Nothing was charged.</h1>
        <p className="text-lg text-soft max-w-[52ch]">
          {title && stillHere
            ? `${title} is still here whenever you’re ready.`
            : 'Your card wasn’t charged. Take your time looking around.'}{' '}
          Something not working, or have a question?{' '}
          <a href="mailto:kirkbrillon@gmail.com" className="text-foreground font-semibold border-b border-primary hover:text-primary">
            Email me
          </a>
          .
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3 pt-2">
          {product && stillHere && (
            <Link
              href={`/shop/${product.slug}/`}
              className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded hover:bg-[#F4B868] transition-colors"
            >
              Back to {title}
            </Link>
          )}
          <Link
            href="/"
            className={
              product && stillHere
                ? 'font-semibold border-b-2 border-primary pb-0.5 hover:text-primary'
                : 'bg-primary text-primary-foreground font-bold px-6 py-3 rounded hover:bg-[#F4B868] transition-colors'
            }
          >
            Back to the gallery
          </Link>
        </div>
      </div>
    </Layout>
  );
}
