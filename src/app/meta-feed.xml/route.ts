// Meta catalog feed (Instagram/Facebook shop): https://www.tysondrawsstuff.com/meta-feed.xml (see src/lib/product-feed.ts)
import { buildProductFeed } from '@/lib/product-feed';

export const dynamic = 'force-static';

export async function GET() {
  const xml = await buildProductFeed({ includeShowPieces: true });
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
