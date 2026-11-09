// Google Merchant Center product feed: https://www.tysondrawsstuff.com/merchant-feed.xml (see src/lib/product-feed.ts)
import { buildProductFeed } from '@/lib/product-feed';

export const dynamic = 'force-static';

export async function GET() {
  const xml = await buildProductFeed();
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
