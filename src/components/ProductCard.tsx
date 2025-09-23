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

            {/* Featured Badge */}
            {(featured || product.featured) && (
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
            <h3 className="text-lg font-semibold text-card-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors">
              {product.title}
            </h3>

            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-primary">
                ${product.price.toFixed(2)}
              </p>

              <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-orange-600 transition-colors">
                Buy Now
              </button>
            </div>

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
          </div>
        </div>
      </Link>
    </div>
  );
}