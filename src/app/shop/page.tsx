import Link from 'next/link';
import Image from 'next/image';
import Layout from '@/components/Layout';
import { fetchProducts, getStrapiImageUrl, type Product } from '@/lib/api';

// Revalidate every 60 seconds
export const revalidate = 60;

export default async function ShopPage() {
  const products = await fetchProducts();

  return (
    <Layout>
      <div className="py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-foreground">Shop All Products</h1>

          {products.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-6">No products available at the moment.</p>
              <Link href="/" className="text-primary hover:text-orange-600 font-semibold">
                ← Back to Home
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: Product) => (
                <div key={product.id} className="group">
                  <Link href={`/shop/${product.slug}`}>
                    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]">
                      <div className="aspect-square relative bg-muted">
                        {product.images && product.images.length > 0 ? (
                          <Image
                            src={getStrapiImageUrl(product.images[0])}
                            alt={product.images[0].alternativeText || product.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            No image available
                          </div>
                        )}

                        {/* Featured Badge */}
                        {product.featured && (
                          <div className="absolute top-3 left-3">
                            <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                              Featured
                            </span>
                          </div>
                        )}

                        {/* Category Badge */}
                        {product.category && (
                          <div className="absolute top-3 right-3">
                            <span className="bg-secondary text-secondary-foreground text-xs font-medium px-2 py-1 rounded">
                              {product.category.name}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-6">
                        <h2 className="text-lg font-semibold text-card-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                          {product.title}
                        </h2>
                        <p className="text-2xl font-bold text-primary">
                          ${product.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}