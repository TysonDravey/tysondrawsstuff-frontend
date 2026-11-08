import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ListingPage from '@/components/ListingPage';
import ProductGrid from '@/components/ProductGrid';
import {
  fetchPosterProductsPaginated,
  fetchCategoriesWithProducts,
  fetchGlobal,
} from '@/lib/api';
import { siteUrl } from '@/lib/site';
import { formatPrice } from '@/lib/display';

interface PostersPagePaginatedProps {
  params: Promise<{
    pageNumber: string;
  }>;
}


export async function generateMetadata({ params }: PostersPagePaginatedProps): Promise<Metadata> {
  const { pageNumber } = await params;

  return {
    title: `Posters - Page ${pageNumber} | Tyson Draws Stuff`,
    description: 'High-quality poster prints of original artwork by Kirk Brillon.',
    alternates: {
      canonical: siteUrl(`/posters/page/${pageNumber}`),
    },
  };
}

export async function generateStaticParams() {
  try {
    const { pagination } = await fetchPosterProductsPaginated(1, 16);
    const params = [];

    // Generate params for pages 2 and up (page 1 handled by main posters page)
    for (let i = 2; i <= pagination.pageCount; i++) {
      params.push({
        pageNumber: i.toString(),
      });
    }

    return params;
  } catch {
    console.warn('Failed to generate static params for posters pagination');
    return [];
  }
}

export default async function PostersPagePaginated({ params }: PostersPagePaginatedProps) {
  const { pageNumber } = await params;
  const pageNum = parseInt(pageNumber);

  // Validate page number
  if (isNaN(pageNum) || pageNum < 1) {
    notFound();
  }

  const [{ products, pagination }, categories, globalSettings] = await Promise.all([
    fetchPosterProductsPaginated(pageNum, 16),
    fetchCategoriesWithProducts(),
    fetchGlobal(),
  ]);

  // If page number is too high, show 404
  if (pageNum > pagination.pageCount) {
    notFound();
  }

  const posterPrice = globalSettings.posterPrice;

  return (
    <ListingPage
      categories={categories}
      trail={[['Posters', '/posters/'], [`Page ${pageNum}`]]}
      eyebrow="Prints"
      title="Posters"
      intro={<>Poster prints of the originals{posterPrice ? `, ${formatPrice(posterPrice)} each` : ''}. Free shipping within Canada.</>}
      pagination={{ ...pagination, baseUrl: '/posters' }}
    >
      <ProductGrid products={products} poster posterPrice={posterPrice} />
    </ListingPage>
  );
}
