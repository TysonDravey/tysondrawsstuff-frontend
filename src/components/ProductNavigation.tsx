'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/lib/api';

interface ProductNavigationProps {
  currentProduct: Product;
  allProducts: Product[];
  context: 'category' | 'show';
}

export default function ProductNavigation({ currentProduct, allProducts, context }: ProductNavigationProps) {
  const [prevProduct, setPrevProduct] = useState<Product | null>(null);
  const [nextProduct, setNextProduct] = useState<Product | null>(null);

  useEffect(() => {
    const currentIndex = allProducts.findIndex(p => p.id === currentProduct.id);

    if (currentIndex === -1) return;

    // Get previous product (wrap around to end if at start)
    const prevIndex = currentIndex === 0 ? allProducts.length - 1 : currentIndex - 1;
    setPrevProduct(allProducts[prevIndex] || null);

    // Get next product (wrap around to start if at end)
    const nextIndex = currentIndex === allProducts.length - 1 ? 0 : currentIndex + 1;
    setNextProduct(allProducts[nextIndex] || null);
  }, [currentProduct, allProducts]);

  if (allProducts.length <= 1) return null;

  const contextLabel = context === 'category'
    ? currentProduct.category?.name
    : currentProduct.currentShow?.title;

  return (
    <div className="border-t border-border pt-6">
      <div className="flex items-center justify-between">
        {/* Previous Product */}
        {prevProduct ? (
          <Link
            href={`/shop/${prevProduct.slug}`}
            className="flex items-center text-primary hover:text-orange-600 transition-colors group"
          >
            <svg
              className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <div className="text-left">
              <div className="text-xs text-muted-foreground">Previous</div>
              <div className="font-medium line-clamp-1">{prevProduct.title}</div>
            </div>
          </Link>
        ) : (
          <div />
        )}

        {/* Context Label */}
        {contextLabel && (
          <div className="hidden sm:block text-center">
            <div className="text-xs text-muted-foreground">
              {context === 'category' ? 'In Category' : 'At Show'}
            </div>
            <div className="text-sm font-medium text-card-foreground">
              {contextLabel}
            </div>
          </div>
        )}

        {/* Next Product */}
        {nextProduct ? (
          <Link
            href={`/shop/${nextProduct.slug}`}
            className="flex items-center text-primary hover:text-orange-600 transition-colors group"
          >
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Next</div>
              <div className="font-medium line-clamp-1">{nextProduct.title}</div>
            </div>
            <svg
              className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
