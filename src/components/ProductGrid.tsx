import Link from 'next/link';
import ProductCard from './ProductCard';
import { type Product } from '@/lib/api';

interface ProductGridProps {
  products: Product[];
  /** Show the products as poster prints (used on the Posters pages). */
  poster?: boolean;
  posterPrice?: number;
}

export default function ProductGrid({ products, poster = false, posterPrice }: ProductGridProps) {
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
        <ProductCard key={product.id} product={product} poster={poster} posterPrice={posterPrice} />
      ))}
    </div>
  );
}