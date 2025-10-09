import Link from 'next/link';
import Image from 'next/image';
import { type Product } from '@/lib/api';
import { getProductImageUrl } from '@/lib/images';

interface ProductCardProps {
  product: Product;
  featured?: boolean;
}

export default function ProductCard({ product, featured = false }: ProductCardProps) {
  return (
    <div className="group">
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

            {/* SOLD Overlay */}
            {product.sold && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="bg-red-600 text-white text-3xl font-bold px-8 py-4 rounded-lg transform -rotate-12 shadow-2xl border-4 border-white">
                  SOLD
                </div>
              </div>
            )}

            {/* Featured Badge */}
            {(featured || product.featured) && !product.sold && (
              <div className="absolute top-3 left-3">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Featured
                </span>
              </div>
            )}

            {/* Show Badge */}
            {product.currentShow && product.showPrice && !product.sold && (
              <div className="absolute top-3 right-3">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
                  At Show
                </span>
              </div>
            )}

            {/* Category Badge */}
            {product.category && !(product.currentShow && product.showPrice) && !product.sold && (
              <div className="absolute top-3 right-3">
                <span className="bg-secondary text-secondary-foreground text-xs font-medium px-2 py-1 rounded">
                  {product.category.name}
                </span>
              </div>
            )}
          </div>

          <div className="p-6">
            <h3 className="text-lg font-semibold text-card-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors">
              {product.title}
            </h3>

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

            {/* Description for featured products */}
            {featured && product.description && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {typeof product.description === 'string'
                    ? product.description.slice(0, 100) + (product.description.length > 100 ? '...' : '')
                    : 'Product description available'
                  }
                </p>
              </div>
            )}

            {/* View Item button for featured products */}
            {featured && (
              <div className="mt-4 pt-3 border-t border-border">
                <span className="inline-flex items-center text-primary hover:text-orange-600 transition-colors font-medium text-sm">
                  View Item
                  <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}