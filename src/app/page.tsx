import Link from 'next/link';
import Image from 'next/image';
import Layout from '@/components/Layout';
import ProductCard from '@/components/ProductCard';
import { fetchFeaturedProducts, type Product } from '@/lib/api';

// Revalidate every 60 seconds
export const revalidate = 60;

export default async function Home() {
  const featuredProducts = await fetchFeaturedProducts();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-background py-20 lg:py-32">
        <div className="container mx-auto px-4 text-center">
          {/* Logo */}
          <div className="mb-8">
            <Image
              src={`${process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1339'}/uploads/tysondrawsstuff_web_logo_06_e9ebe2d054.png`}
              alt="Tyson Draws Stuff Logo"
              width={300}
              height={300}
              className="mx-auto"
              priority
            />
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground mb-6">
            Tyson Draws Stuff
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Original Art, Prints, and More
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              href="/shop"
              className="bg-primary text-primary-foreground px-10 py-4 rounded-lg font-semibold hover:bg-red-700 transition-colors text-lg"
            >
              Shop All
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
              Featured Artwork
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Discover our handpicked selection of featured pieces
            </p>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-6">No featured products available at the moment.</p>
              <Link
                href="/shop"
                className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                Browse all products →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {featuredProducts.slice(0, 3).map((product: Product) => (
                <ProductCard key={product.id} product={product} featured={true} />
              ))}
            </div>
          )}

          {/* View All Products Link */}
          {featuredProducts.length > 0 && (
            <div className="text-center mt-16">
              <Link
                href="/shop"
                className="inline-flex items-center text-primary hover:text-red-700 font-semibold text-lg transition-colors"
              >
                View All Products
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
