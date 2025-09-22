import Link from 'next/link';
import Image from 'next/image';
import { fetchFeaturedProducts, getStrapiImageUrl, type Product } from '@/lib/api';

// Revalidate every 60 seconds
export const revalidate = 60;

export default async function Home() {
  const featuredProducts = await fetchFeaturedProducts();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 lg:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Tyson Draws Stuff
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Original artwork, posters, and unique merchandise from artist Kirk Brillon
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/shop"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Browse All Art
            </Link>
            <Link
              href="/category/original-art"
              className="bg-gray-200 text-gray-800 px-8 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Original Pieces
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Featured Artwork
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Discover our handpicked selection of featured pieces
            </p>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No featured products available at the moment.</p>
              <Link
                href="/shop"
                className="inline-block mt-4 text-blue-600 hover:text-blue-800 font-semibold"
              >
                Browse all products →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featuredProducts.map((product: Product) => (
                <div key={product.id} className="group">
                  <Link href={`/shop/${product.slug}`}>
                    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
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
                        <div className="absolute top-2 left-2">
                          <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">
                            Featured
                          </span>
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                          {product.title}
                        </h3>
                        <div className="flex items-center justify-between">
                          <p className="text-2xl font-bold text-green-600">
                            ${product.price.toFixed(2)}
                          </p>
                          {product.category && (
                            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {product.category.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* View All Products Link */}
          <div className="text-center mt-12">
            <Link
              href="/shop"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold text-lg"
            >
              View All Products
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Shop by Category
            </h2>
            <p className="text-lg text-gray-600">
              Explore our different types of artwork and merchandise
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Original Art', slug: 'original-art', description: 'One-of-a-kind pieces' },
              { name: 'Posters', slug: 'posters', description: 'High-quality prints' },
              { name: 'Merch', slug: 'merch', description: 'Apparel & accessories' },
              { name: 'Books', slug: 'books', description: 'Art books & collections' }
            ].map((category) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow text-center group"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600">
                  {category.name}
                </h3>
                <p className="text-gray-600">{category.description}</p>
                <div className="mt-4 text-blue-600 font-medium">
                  Browse →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
