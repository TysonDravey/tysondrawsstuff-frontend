import Link from 'next/link';
import Image from 'next/image';
import { type Product } from '@/lib/api';
import { getProductImageUrl } from '@/lib/images';
import { displayTitle, activeShow, isOriginal, formatPrice } from '@/lib/display';

interface ProductCardProps {
  product: Product;
  featured?: boolean;
  /** Poster listings: sell the print, so a sold original never makes the poster look unavailable. */
  poster?: boolean;
  posterPrice?: number;
}

function PosterCard({ product, posterPrice }: { product: Product; posterPrice?: number }) {
  const image = product.images?.[0];
  return (
    <Link href={`/shop/${product.slug}/`} className="group block">
      <div className="aspect-[3/4] relative bg-card overflow-hidden">
        {image ? (
          <Image
            src={getProductImageUrl(product.slug, image, 0)}
            alt={`${displayTitle(product.title)} poster`}
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">No image available</div>
        )}
      </div>
      <div className="pt-3 flex items-baseline justify-between gap-3">
        <h3 className="font-sans font-semibold text-[15px] group-hover:text-primary transition-colors">{displayTitle(product.title)}</h3>
        {posterPrice ? <span className="text-[15px] whitespace-nowrap">${posterPrice}</span> : null}
      </div>
      <p className="text-[13px] text-muted-foreground mt-0.5">
        Poster print{product.sold === true ? ' · original sold' : ' · original also available'}
      </p>
    </Link>
  );
}

// Books, merch, the "all products" shop: the item on a dark card, title and price beneath.
// (`featured` is kept for older callers; it no longer changes the look.)
export default function ProductCard({ product, poster = false, posterPrice }: ProductCardProps) {
  if (poster) return <PosterCard product={product} posterPrice={posterPrice} />;

  const show = activeShow(product);
  const sold = product.sold === true;
  const image = product.images?.[0];
  const price = (show && product.showPrice) || product.price;
  const status = sold
    ? 'Sold'
    : show
      ? `At ${show.title}`
      : isOriginal(product)
        ? `Original${product.hasPoster ? ' · poster available' : ''}`
        : product.category?.name;

  return (
    <Link href={`/shop/${product.slug}/`} className="group block">
      <div className="aspect-square relative bg-card overflow-hidden">
        {image ? (
          <Image
            src={getProductImageUrl(product.slug, image, 0)}
            alt={image.alternativeText || displayTitle(product.title)}
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 100vw"
            className={`object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03] ${sold ? 'opacity-55' : ''}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">No image available</div>
        )}
      </div>
      <div className="pt-3 flex items-baseline justify-between gap-3">
        <h3 className="font-sans font-semibold text-[15px] group-hover:text-primary transition-colors">{displayTitle(product.title)}</h3>
        {!sold && (
          <span className="text-[15px] whitespace-nowrap">
            {show && product.showPrice ? <s className="text-muted-foreground mr-1.5">{formatPrice(product.price)}</s> : null}
            {formatPrice(price)}
          </span>
        )}
      </div>
      {status && (
        <p className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          {sold && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#D7262E]" />}
          {!sold && show && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-primary" />}
          {status}
        </p>
      )}
    </Link>
  );
}
