import Link from 'next/link';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import { fetchCategoriesWithProducts } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Not found | Tyson Draws Stuff',
  robots: { index: false },
};

// 404: an empty frame on the gallery wall.
export default async function NotFound() {
  const categories = await fetchCategoriesWithProducts().catch(() => []);

  return (
    <Layout categories={categories}>
      <div className="salon-room">
        <div className="mx-auto max-w-5xl px-4 sm:px-8 py-16 sm:py-24 grid gap-12 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-center">
          <div className="salon grid place-items-center">
            <span className="lit block w-[min(70vw,260px)]" style={{ transform: 'rotate(-2deg)' }}>
              <span
                className="painting frame-gold_floral relative block aspect-[4/5]"
                style={{ background: 'linear-gradient(160deg, #3a0f12, #2a0a0d)' }}
              >
                <span aria-hidden="true" className="painting-light" />
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-5 text-center md:text-left items-center md:items-start">
            <p className="eyebrow">404 · page not found</p>
            <h1 className="font-display text-4xl sm:text-[56px] leading-[1.05]">Nothing hanging here.</h1>
            <p className="text-lg text-soft max-w-[44ch]">
              This piece has moved, sold, or never existed. The rest of the gallery is right this way.
            </p>
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-6 gap-y-3 pt-2">
              <Link
                href="/"
                className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded hover:bg-[#F4B868] transition-colors"
              >
                Back to the gallery
              </Link>
              <Link href="/category/category/" className="font-semibold border-b-2 border-primary pb-0.5 hover:text-primary">
                See all originals
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
