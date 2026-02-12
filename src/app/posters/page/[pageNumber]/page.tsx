import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import ProductGrid from '@/components/ProductGrid';
import Pagination from '@/components/Pagination';
import {
  fetchPosterProductsPaginated,
  fetchCategoriesWithProducts,
  fetchGlobal,
} from '@/lib/api';

interface PostersPagePaginatedProps {
  params: Promise<{
    pageNumber: string;
  }>;
}

const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'https://tysondrawsstuff.com';
};

export async function generateMetadata({ params }: PostersPagePaginatedProps): Promise<Metadata> {
  const { pageNumber } = await params;
  const baseUrl = getBaseUrl();

  return {
    title: `Posters - Page ${pageNumber} | Tyson Draws Stuff`,
    description: 'High-quality poster prints of original artwork by Kirk Brillon.',
    alternates: {
      canonical: `${baseUrl}/posters/page/${pageNumber}`,
    },
  };
}

export async function generateStaticParams() {
  try {
    const { pagination } = await fetchPosterProductsPaginated(1, 16);
    const params = [];

    // Generate params for pages 2 and up (page 1 handled by main posters page)
    for (let i = 2; i <= pagination.pageCount; i++) {
      params.push({
        pageNumber: i.toString(),
      });
    }

    return params;
  } catch {
    console.warn('Failed to generate static params for posters pagination');
    return [];
  }
}

export default async function PostersPagePaginated({ params }: PostersPagePaginatedProps) {
  const { pageNumber } = await params;
  const pageNum = parseInt(pageNumber);

  // Validate page number
  if (isNaN(pageNum) || pageNum < 1) {
    notFound();
  }

  const [{ products, pagination }, categories, globalSettings] = await Promise.all([
    fetchPosterProductsPaginated(pageNum, 16),
    fetchCategoriesWithProducts(),
    fetchGlobal(),
  ]);

  // If page number is too high, show 404
  if (pageNum > pagination.pageCount) {
    notFound();
  }

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
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
                Posters
              </h1>
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pageCount} ({pagination.total} total products)
              </div>
            </div>
            <p className="text-xl text-muted-foreground max-w-3xl">
              All of these original artworks are available as high-quality poster prints.
              {posterPrice && ` $${posterPrice} each.`}
            </p>
          </div>

          <ProductGrid products={products} />

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pageCount}
            baseUrl="/posters"
          />

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
