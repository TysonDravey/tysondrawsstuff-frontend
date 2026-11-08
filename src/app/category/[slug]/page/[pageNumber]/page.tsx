import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CategoryListing, { ORIGINALS_SLUG, PER_PAGE } from '@/components/CategoryListing';
import { fetchProductsByCategoryPaginated, fetchCategories } from '@/lib/api';
import { siteUrl } from '@/lib/site';

interface CategoryPagePaginatedProps {
  params: Promise<{ slug: string; pageNumber: string }>;
}

export async function generateMetadata({ params }: CategoryPagePaginatedProps): Promise<Metadata> {
  const { slug, pageNumber } = await params;
  return {
    alternates: {
      canonical: siteUrl(`/category/${slug}/page/${pageNumber}`),
    },
  };
}

// Pages 2+ for each category (page 1 is the category page). Originals have no pages: the salon
// wall shows them all.
export async function generateStaticParams() {
  try {
    const params = [];
    for (const category of await fetchCategories()) {
      if (category.slug === ORIGINALS_SLUG) continue;
      const { pagination } = await fetchProductsByCategoryPaginated(category.slug, 1, PER_PAGE);
      for (let i = 2; i <= pagination.pageCount; i++) {
        params.push({ slug: category.slug, pageNumber: i.toString() });
      }
    }
    return params;
  } catch {
    console.warn('Failed to generate static params for category pagination');
    return [];
  }
}

export default async function CategoryPagePaginated({ params }: CategoryPagePaginatedProps) {
  const { slug, pageNumber } = await params;
  const page = parseInt(pageNumber);
  if (isNaN(page) || page < 1 || slug === ORIGINALS_SLUG) notFound();
  return <CategoryListing slug={slug} page={page} />;
}
