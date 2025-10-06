import Link from 'next/link';
import Image from 'next/image';
import { type Product } from '@/lib/api';
import { getProductImageUrl } from '@/lib/images';

interface ProductGridProps {
  products: Product[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg mb-6">No products available at the moment.</p>
        <Link href="/" className="text-primary hover:text-orange-600 font-semibold">
          ← Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product: Product) => (
        <div key={product.id} className="group">
          <Link href={`/shop/${product.slug}`}>
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]">
              <div className="aspect-square relative bg-muted">
                {product.images && product.images.length > 0 ? (
                  <Image
                    src={getProductImageUrl(product.slug, product.images[0], 0)}
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

                {/* Show Badge */}
                {product.currentShow && product.showPrice && (
                  <div className="absolute top-3 right-3">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
                      At Show
                    </span>
                  </div>
                )}

                {/* Category Badge */}
                {product.category && !(product.currentShow && product.showPrice) && (
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
                {/* Pricing */}
                {product.currentShow && product.showPrice ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-lg text-muted-foreground line-through">
                        ${product.price.toFixed(2)}
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        ${product.showPrice.toFixed(2)}
                      </p>
                    </div>
                    <p className="text-xs text-primary font-medium">
                      Show Special at {product.currentShow.title}
                    </p>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-primary">
                    ${product.price.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}