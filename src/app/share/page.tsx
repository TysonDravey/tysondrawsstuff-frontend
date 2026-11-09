// Post studio: pick a product on the phone, get an Instagram-shaped image and a ready caption,
// then share straight to Instagram/Facebook. Unlinked and not indexed; nothing here is private.
import type { Metadata } from 'next';
import { fetchProducts, fetchGlobal } from '@/lib/api';
import { getProductImages } from '@/lib/images';
import { displayTitle, describeOriginal, isOriginal, activeShow, showDates, plainExcerpt } from '@/lib/display';
import { siteUrl } from '@/lib/site';
import ShareStudio, { type ShareItem } from '@/components/ShareStudio';

export const metadata: Metadata = {
  title: 'Post studio | Tyson Draws Stuff',
  robots: { index: false, follow: false },
};

export default async function SharePage() {
  const [products, globalSettings] = await Promise.all([fetchProducts(), fetchGlobal()]);
  const posterPrice = globalSettings.posterPrice;

  const items: ShareItem[] = products
    .map(p => {
      const original = isOriginal(p);
      const show = activeShow(p);
      const { story, details } = original ? describeOriginal(p.description) : { story: null, details: [] };
      return {
        slug: p.slug,
        title: displayTitle(p.title),
        url: siteUrl(`/shop/${p.slug}`),
        category: p.category?.name ?? 'Shop',
        original,
        sold: p.sold === true,
        price: p.price,
        story: original ? story : plainExcerpt(p.description, 220),
        details,
        show: show
          ? {
              title: show.title,
              location: show.location?.trim().replace(/\.$/, '') || null,
              until: showDates(show).split(' – ')[1],
              price: p.showPrice ?? null,
            }
          : null,
        posterPrice: p.hasPoster && posterPrice ? posterPrice : null,
        images: getProductImages(p.slug).map(i => ({ src: i.src, width: i.width ?? 0, height: i.height ?? 0 })),
      };
    })
    .filter(i => i.images.length > 0);

  return <ShareStudio items={items} />;
}
