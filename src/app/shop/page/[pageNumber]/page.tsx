import Layout from '@/components/Layout';
import ProductGrid from '@/components/ProductGrid';
import Pagination from '@/components/Pagination';
import { fetchProductsPaginated, fetchCategoriesWithProducts } from '@/lib/api';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{
    pageNumber: string;
  }>;
}

// Generate static params for pagination pages
export async function generateStaticParams() {
  try {
    // Fetch first page to get total count
    const { pagination } = await fetchProductsPaginated(1, 8);
    const totalPages = pagination.pageCount;

    // Generate params for all pages except page 1 (handled by main shop page)
    const pages = [];
    for (let i = 2; i <= totalPages; i++) {
      pages.push({ pageNumber: i.toString() });
    }

    return pages;
  } catch {
    console.warn('Failed to generate static params for shop pagination');
    return [];
  }
}

export default async function ShopPagePaginated({ params }: PageProps) {
  const resolvedParams = await params;
  const pageNumber = parseInt(resolvedParams.pageNumber);

  // Validate page number
  if (isNaN(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const [{ products, pagination }, categories] = await Promise.all([
    fetchProductsPaginated(pageNumber, 8),
    fetchCategoriesWithProducts()
  ]);

  // If page number is too high, show 404
  if (pageNumber > pagination.pageCount) {
    notFound();
  }

  return (
    <Layout categories={categories}>
      <div className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Shop All Products</h1>
            <div className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.pageCount} ({pagination.total} total products)
            </div>
          </div>

          <ProductGrid products={products} />

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pageCount}
            baseUrl="/shop"
          />
        </div>
      </div>
    </Layout>
  );
}