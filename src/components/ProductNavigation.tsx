import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/api';
import { getProductImages } from '@/lib/images';
import { displayTitle } from '@/lib/display';

interface ProductNavigationProps {
  currentProduct: Product;
  allProducts: Product[];
  /** e.g. "Original Art" or a show's title */
  contextLabel?: string;
  contextHref?: string;
}

// Previous / next piece in the same category (or the same show), with a small picture of each.
// Wraps around at the ends.
export default function ProductNavigation({ currentProduct, allProducts, contextLabel, contextHref }: ProductNavigationProps) {
  const i = allProducts.findIndex(p => p.id === currentProduct.id);
  if (i === -1 || allProducts.length <= 1) return null;
  const prev = allProducts[(i - 1 + allProducts.length) % allProducts.length];
  const next = allProducts[(i + 1) % allProducts.length];

  const Card = ({ p, dir }: { p: Product; dir: 'prev' | 'next' }) => {
    const img = getProductImages(p.slug, p.images || [])[0];
    const isNext = dir === 'next';
    return (
      <Link
        href={`/shop/${p.slug}/`}
        className={`group flex items-center gap-4 min-w-0 ${isNext ? 'flex-row-reverse text-right' : ''}`}
      >
        <span className="relative w-16 h-20 sm:w-20 sm:h-24 shrink-0 overflow-hidden bg-card shadow-[4px_8px_16px_rgba(0,0,0,.45)]">
          {img && <Image src={img.src} alt="" fill sizes="80px" className="object-cover transition-transform duration-300 group-hover:scale-105" />}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {isNext ? 'Next' : 'Previous'}
          </span>
          <span className="block font-display text-lg leading-snug truncate group-hover:text-primary transition-colors">
            {displayTitle(p.title)}
          </span>
        </span>
      </Link>
    );
  };

  return (
    <nav aria-label="More work" className="border-t border-border pt-8 grid grid-cols-2 sm:grid-cols-[1fr_auto_1fr] items-center gap-6">
      <Card p={prev} dir="prev" />
      {contextLabel && (
        <div className="hidden sm:block text-center">
          <span className="block text-xs uppercase tracking-[0.14em] text-muted-foreground">More in</span>
          {contextHref ? (
            <Link href={contextHref} className="font-semibold hover:text-primary">{contextLabel}</Link>
          ) : (
            <span className="font-semibold">{contextLabel}</span>
          )}
        </div>
      )}
      <Card p={next} dir="next" />
    </nav>
  );
}
