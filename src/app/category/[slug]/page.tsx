import { notFound } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import ProductCard from '@/components/ProductCard';
import {
  fetchProductsByCategory,
  fetchCategoryBySlug,
  fetchCategories,
  type Product
} from '@/lib/api';

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Revalidate every 60 seconds
export const revalidate = 60;

export async function generateStaticParams() {
  const categories = await fetchCategories();

  return categories.map((category) => ({
    slug: category.slug,
  }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await fetchCategoryBySlug(slug);
  const products = await fetchProductsByCategory(slug);

  if (!category) {
    notFound();
  }

  return (
    <Layout>
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
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-xl text-muted-foreground max-w-3xl">
                {category.description}
              </p>
            )}
          </div>

          {/* Category Navigation */}
          <div className="mb-12">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="px-6 py-3 text-sm font-medium text-muted-foreground bg-secondary rounded-lg hover:bg-gray-700 transition-colors"
              >
                All Products
              </Link>
              {(await fetchCategories()).map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className={`px-6 py-3 text-sm font-medium rounded-lg transition-colors ${
                    cat.slug === slug
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground bg-secondary hover:bg-gray-700'
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          {products.length === 0 ? (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <h2 className="text-3xl font-bold text-foreground mb-6">
                  No products found
                </h2>
                <p className="text-muted-foreground mb-8 text-lg">
                  We don&apos;t have any products in the {category.name} category yet. Check back soon!
                </p>
                <Link
                  href="/shop"
                  className="inline-block bg-primary text-primary-foreground py-3 px-8 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  Browse All Products
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Results Count */}
              <div className="mb-8">
                <p className="text-muted-foreground text-lg">
                  Showing {products.length} {products.length === 1 ? 'product' : 'products'} in {category.name}
                </p>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {products.map((product: Product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Back to Shop Link */}
              <div className="text-center mt-16">
                <Link
                  href="/shop"
                  className="inline-flex items-center text-primary hover:text-red-700 font-semibold text-lg"
                >
                  <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Browse All Products
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}