// Google Merchant Center product feed (free Shopping listings): https://www.tysondrawsstuff.com/merchant-feed.xml
// Everything that can be bought online right now: available originals (not hanging at a show), posters,
// books and merch. Images are the small unwatermarked copies from public/feed-images.json (made by
// scripts/sync-images.js): Shopping rejects watermarked images. Items without one are left out.
import fs from 'fs';
import path from 'path';
import { fetchProducts, fetchGlobal, type Product } from '@/lib/api';
import { siteUrl } from '@/lib/site';
import { displayTitle, isOriginal, activeShow } from '@/lib/display';
import { productDescription } from '@/lib/structured-data';

export const dynamic = 'force-static';

type FeedImage = { url: string; width: number; height: number };

function feedImages(): Record<string, FeedImage> {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'feed-images.json'), 'utf8'));
  } catch {
    return {};
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ARTWORK = 'Home &amp; Garden &gt; Decor &gt; Artwork &gt; Posters, Prints, &amp; Visual Artwork';
const BOOKS = 'Media &gt; Books';

function item(fields: {
  id: string; title: string; description: string; link: string; image: string;
  price: number; category?: string; productType: string;
}) {
  return `
    <item>
      <g:id>${esc(fields.id)}</g:id>
      <g:title>${esc(fields.title.slice(0, 150))}</g:title>
      <g:description>${esc(fields.description.slice(0, 5000))}</g:description>
      <g:link>${esc(fields.link)}</g:link>
      <g:image_link>${esc(fields.image)}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>${fields.price.toFixed(2)} CAD</g:price>
      <g:condition>new</g:condition>
      <g:brand>Tyson Draws Stuff</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      ${fields.category ? `<g:google_product_category>${fields.category}</g:google_product_category>` : ''}
      <g:product_type>${esc(fields.productType)}</g:product_type>
      <g:shipping>
        <g:country>CA</g:country>
        <g:price>0.00 CAD</g:price>
      </g:shipping>
    </item>`;
}

export async function GET() {
  const [products, globalSettings] = await Promise.all([fetchProducts(), fetchGlobal()]);
  const images = feedImages();
  const posterPrice = globalSettings.posterPrice;
  const items: string[] = [];

  for (const p of products as Product[]) {
    const image = images[p.slug]?.url;
    if (!image) continue;
    const title = displayTitle(p.title);
    const link = siteUrl(`/shop/${p.slug}`);
    const description = productDescription(p);
    const original = isOriginal(p);

    // The piece itself: only if it can be bought online now (not sold, not hanging at a show).
    if (p.sold !== true && !activeShow(p)) {
      const books = p.category?.slug === 'books';
      items.push(item({
        id: p.slug,
        title: original ? `${title}: original painting by Tyson Draws Stuff` : title,
        description,
        link,
        image,
        price: p.price,
        category: original ? ARTWORK : books ? BOOKS : undefined,
        productType: original ? 'Original art' : p.category?.name ?? 'Shop',
      }));
    }

    // Its poster print, whether or not the original has sold.
    if (p.hasPoster && posterPrice) {
      items.push(item({
        id: `${p.slug}-poster`,
        title: `${title}: poster print by Tyson Draws Stuff`,
        description: `Poster print of ${title}, an original by Tyson Draws Stuff (Kirk Brillon). ${description}`,
        link: `${link}#poster`,
        image,
        price: posterPrice,
        category: ARTWORK,
        productType: 'Poster print',
      }));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Tyson Draws Stuff</title>
    <link>${siteUrl()}</link>
    <description>Original paintings, poster prints, books and merch by Kirk Brillon. Free shipping within Canada.</description>${items.join('')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
