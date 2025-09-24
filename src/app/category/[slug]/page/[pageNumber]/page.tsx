import { notFound } from 'next/navigation';
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

interface CategoryPagePaginatedProps {
  params: Promise<{
    slug: string;
    pageNumber: string;
  }>;
}

// Generate static params for category pagination pages
export async function generateStaticParams() {
  try {
    const categories = await fetchCategories();
    const params = [];

    for (const category of categories) {
      // Get first page to determine total page count
      const { pagination } = await fetchProductsByCategoryPaginated(category.slug, 1, 16);
      const totalPages = pagination.pageCount;

      // Generate params for pages 2 and up (page 1 handled by main category page)
      for (let i = 2; i <= totalPages; i++) {
        params.push({
          slug: category.slug,
          pageNumber: i.toString(),
        });
      }
    }

    return params;
  } catch {
    console.warn('Failed to generate static params for category pagination');
    return [];
  }
}

export default async function CategoryPagePaginated({ params }: CategoryPagePaginatedProps) {
  const resolvedParams = await params;
  const { slug, pageNumber } = resolvedParams;
  const pageNum = parseInt(pageNumber);

  // Validate page number
  if (isNaN(pageNum) || pageNum < 1) {
    notFound();
  }

  const [category, { products, pagination }, categories] = await Promise.all([
    fetchCategoryBySlug(slug),
    fetchProductsByCategoryPaginated(slug, pageNum, 16),
    fetchCategoriesWithProducts()
  ]);

  if (!category) {
    notFound();
  }

  // If page number is too high, show 404
  if (pageNum > pagination.pageCount) {
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
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pageCount} ({pagination.total} total products)
              </div>
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