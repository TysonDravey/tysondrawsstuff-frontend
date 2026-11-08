import type { Metadata } from 'next';
import ListingPage from '@/components/ListingPage';
import ProductGrid from '@/components/ProductGrid';
import { fetchProductsPaginated, fetchCategoriesWithProducts } from '@/lib/api';
import { notFound } from 'next/navigation';
import { siteUrl } from '@/lib/site';

interface PageProps {
  params: Promise<{
    pageNumber: string;
  }>;
}



export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { pageNumber } = resolvedParams;
  
  return {
    alternates: {
      canonical: siteUrl(`/shop/page/${pageNumber}`),
    },
  };
}

// Generate static params for pagination pages
export async function generateStaticParams() {
  try {
    // Fetch first page to get total count
    const { pagination } = await fetchProductsPaginated(1, 16);
    const totalPages = pagination.pageCount;

    // Generate params for all pages except page 1 (handled by main shop page)
    const pages = [];
    for (let i = 2; i <= totalPages; i++) {
      pages.push({ pageNumber: i.toString() });
    }

    return pages;
  } catch {
    console.warn('Failed to generate static params for shop pagination');
    return [];
  }
}

export default async function ShopPagePaginated({ params }: PageProps) {
  const resolvedParams = await params;
  const pageNumber = parseInt(resolvedParams.pageNumber);

  // Validate page number
  if (isNaN(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const [{ products, pagination }, categories] = await Promise.all([
    fetchProductsPaginated(pageNumber, 16),
    fetchCategoriesWithProducts()
  ]);

  // If page number is too high, show 404
  if (pageNumber > pagination.pageCount) {
    notFound();
  }

  return (
    <ListingPage
      categories={categories}
      trail={[['Shop', '/shop/'], [`Page ${pageNumber}`]]}
      eyebrow="Shop"
      title="Everything"
      intro="Originals, books and merch, all in one place. Free shipping within Canada."
      pagination={{ ...pagination, baseUrl: '/shop' }}
    >
      <ProductGrid products={products} />
    </ListingPage>
  );
}
