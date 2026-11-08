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


export async function generateMetadata(): Promise<Metadata> {

  return {
    title: 'Posters | Tyson Draws Stuff',
    description: 'High-quality poster prints of original artwork by Kirk Brillon.',
    alternates: {
      canonical: siteUrl(`/posters`),
    },
  };
}

export default async function PostersPage() {
  const [{ products, pagination }, categories, globalSettings] = await Promise.all([
    fetchPosterProductsPaginated(1, 16),
    fetchCategoriesWithProducts(),
    fetchGlobal(),
  ]);

  const posterPrice = globalSettings.posterPrice;

  return (
    <ListingPage
      categories={categories}
      trail={[['Posters']]}
      eyebrow="Prints"
      title="Posters"
      intro={<>Poster prints of the originals{posterPrice ? `, ${formatPrice(posterPrice)} each` : ''}. Free shipping within Canada.</>}
      pagination={{ ...pagination, baseUrl: '/posters' }}
    >
      <ProductGrid products={products} poster posterPrice={posterPrice} />
    </ListingPage>
  );
}
