import type { Metadata } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import ProductGrid from '@/components/ProductGrid';
import {
  fetchPosterProducts,
  fetchCategoriesWithProducts,
  fetchGlobal,
} from '@/lib/api';

const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'https://tysondrawsstuff.com';
};

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();

  return {
    title: 'Posters | Tyson Draws Stuff',
    description: 'High-quality poster prints of original artwork by Kirk Brillon.',
    alternates: {
      canonical: `${baseUrl}/posters`,
    },
  };
}

export default async function PostersPage() {
  const [products, categories, globalSettings] = await Promise.all([
    fetchPosterProducts(),
    fetchCategoriesWithProducts(),
    fetchGlobal(),
  ]);

  const posterPrice = globalSettings.posterPrice;

  return (
    <Layout categories={categories}>
      <div className="py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb Navigation */}
          <nav className="mb-8">
            <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-primary">
                  Home
                </Link>
              </li>
              <li>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </li>
              <li>
                <Link href="/shop" className="hover:text-primary">
                  Shop
                </Link>
              </li>
              <li>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </li>
              <li className="text-foreground font-medium">
                Posters
              </li>
            </ol>
          </nav>

          {/* Page Header */}
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
              Posters
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              All of these original artworks are available as high-quality poster prints.
              {posterPrice && ` $${posterPrice} each.`}
            </p>
          </div>

          <ProductGrid products={products} />

          {/* Back to Shop Link */}
          <div className="text-center mt-16">
            <Link
              href="/shop"
              className="inline-flex items-center text-primary hover:text-orange-600 font-semibold text-lg"
            >
              <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Browse All Products
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
