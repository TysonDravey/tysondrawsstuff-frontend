import type { Product } from './api';
import type { GridItem } from '@/components/home/OriginalsGrid';
import { getProductImages, hasFramedPhoto } from './images';
import { displayTitle, isAvailable, activeShow } from './display';
import { frameFor, frameScale } from './frame-pick';

// The first photo of a product, sized for layout (falls back to a portrait shape).
export function firstImage(product: Product) {
  const img = getProductImages(product.slug, product.images || [])[0];
  if (!img) return null;
  return {
    src: img.src,
    width: img.width || 1200,
    height: img.height || 1600,
    alt: img.alt || displayTitle(product.title),
  };
}

// A product as a painting on the salon wall (home page, show pages).
export function toGridItem(p: Product): GridItem {
  const show = activeShow(p);
  return {
    slug: p.slug,
    title: displayTitle(p.title),
    // While a piece hangs at a show, the wall shows its show price (if one is set).
    price: (show && p.showPrice) || p.price,
    sold: !isAvailable(p),
    hasPoster: !!p.hasPoster,
    // Photographed in its real frame: that photo hangs as-is, no display frame around it.
    // Otherwise the display frame is settled here, where the description is known (canvas → floater).
    frame: hasFramedPhoto(p.slug) ? 'none' : frameFor(p),
    frameScale: frameScale(p),
    atShow: show?.title,
    image: firstImage(p),
  };
}

// Available pieces first, featured first within that.
export function wallOrder(a: Product, b: Product): number {
  return Number(!isAvailable(a)) - Number(!isAvailable(b)) || Number(b.featured) - Number(a.featured);
}
