import type { Metadata } from 'next';
import ListingPage from '@/components/ListingPage';
import ProductGrid from '@/components/ProductGrid';
import { fetchProductsPaginated, fetchCategoriesWithProducts } from '@/lib/api';
import { siteUrl } from '@/lib/site';

// Static export - no revalidation needed



export const metadata: Metadata = {
  title: 'Shop | Tyson Draws Stuff',
  description: 'Original art, books and merch by Tyson Draws Stuff (Kirk Brillon). Free shipping within Canada.',
  alternates: {
    canonical: siteUrl(`/shop`),
  },
};

export default async function ShopPage() {
  const [{ products, pagination }, categories] = await Promise.all([
    fetchProductsPaginated(1, 16), // Page 1, 16 products per page (multiple of 4)
    fetchCategoriesWithProducts()
  ]);

  return (
    <ListingPage
      categories={categories}
      trail={[['Shop']]}
      eyebrow="Shop"
      title="Everything"
      intro="Originals, books and merch, all in one place. Free shipping within Canada."
      pagination={{ ...pagination, baseUrl: '/shop' }}
    >
      <ProductGrid products={products} />
    </ListingPage>
  );
}
