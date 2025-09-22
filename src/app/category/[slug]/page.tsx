import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  fetchProductsByCategory,
  fetchCategoryBySlug,
  fetchCategories,
  getStrapiImageUrl,
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
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb Navigation */}
      <nav className="mb-6">
        <ol className="flex items-center space-x-2 text-sm text-gray-600">
          <li>
            <Link href="/" className="hover:text-gray-800">
              Home
            </Link>
          </li>
          <li>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </li>
          <li>
            <Link href="/shop" className="hover:text-gray-800">
              Shop
            </Link>
          </li>
          <li>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </li>
          <li className="text-gray-900 font-medium">
            {category.name}
          </li>
        </ol>
      </nav>

      {/* Category Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          {category.name}
        </h1>
        {category.description && (
          <p className="text-lg text-gray-600 max-w-3xl">
            {category.description}
          </p>
        )}
      </div>

      {/* Category Navigation */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/shop"
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            All Products
          </Link>
          {(await fetchCategories()).map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                cat.slug === slug
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              No products found
            </h2>
            <p className="text-gray-600 mb-8">
              We don&apos;t have any products in the {category.name} category yet. Check back soon!
            </p>
            <Link
              href="/shop"
              className="inline-block bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Browse All Products
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Results Count */}
          <div className="mb-6">
            <p className="text-gray-600">
              Showing {products.length} {products.length === 1 ? 'product' : 'products'} in {category.name}
            </p>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product: Product) => (
              <div key={product.id} className="group">
                <Link href={`/shop/${product.slug}`}>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300">
                    <div className="aspect-square relative bg-gray-200">
                      {product.images && product.images.length > 0 ? (
                        <Image
                          src={getStrapiImageUrl(product.images[0])}
                          alt={product.images[0].alternativeText || product.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          No image available
                        </div>
                      )}

                      {/* Featured Badge */}
                      {product.featured && (
                        <div className="absolute top-2 left-2">
                          <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">
                            Featured
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {product.title}
                      </h3>
                      <p className="text-2xl font-bold text-green-600">
                        ${product.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {/* Back to Shop Link */}
          <div className="text-center mt-12">
            <Link
              href="/shop"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold"
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
  );
}