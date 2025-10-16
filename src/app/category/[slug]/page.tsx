import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import ProductGrid from '@/components/ProductGrid';
import Pagination from '@/components/Pagination';
import {
  fetchProductsByCategoryPaginated,
  fetchCategoryBySlug,
  fetchCategories,
  fetchCategoriesWithProducts,
} from '@/lib/api';

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Static export - no revalidation needed


const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'https://tysondrawsstuff.com';
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = getBaseUrl();
  
  return {
    alternates: {
      canonical: `${baseUrl}/category/${slug}`,
    },
  };
}

export async function generateStaticParams() {
  const categories = await fetchCategories();

  return categories.map((category) => ({
    slug: category.slug,
  }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const [category, { products, pagination }, categories] = await Promise.all([
    fetchCategoryBySlug(slug),
    fetchProductsByCategoryPaginated(slug, 1, 16), // Page 1, 16 products per page
    fetchCategoriesWithProducts()
  ]);

  if (!category) {
    notFound();
  }

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
                {category.name}
              </li>
            </ol>
          </nav>

          {/* Category Header */}
          <div className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
                {category.name}
              </h1>
              {pagination.pageCount > 1 && (
                <div className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.pageCount} ({pagination.total} total products)
                </div>
              )}
            </div>
            {category.description && (
              <p className="text-xl text-muted-foreground max-w-3xl">
                {category.description}
              </p>
            )}
          </div>


          <ProductGrid products={products} />

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pageCount}
            baseUrl={`/category/${category.slug}`}
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