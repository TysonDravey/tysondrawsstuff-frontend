import Layout from '@/components/Layout';
import ProductGrid from '@/components/ProductGrid';
import Pagination from '@/components/Pagination';
import { fetchProductsPaginated, fetchCategoriesWithProducts } from '@/lib/api';

// Static export - no revalidation needed

export default async function ShopPage() {
  const [{ products, pagination }, categories] = await Promise.all([
    fetchProductsPaginated(1, 16), // Page 1, 16 products per page (multiple of 4)
    fetchCategoriesWithProducts()
  ]);

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