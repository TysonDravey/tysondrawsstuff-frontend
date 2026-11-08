import { notFound } from 'next/navigation';
import ListingPage from '@/components/ListingPage';
import ProductGrid from '@/components/ProductGrid';
import OriginalsGrid from '@/components/home/OriginalsGrid';
import {
  fetchProducts,
  fetchProductsByCategoryPaginated,
  fetchCategoryBySlug,
  fetchCategoriesWithProducts,
  fetchGlobal,
} from '@/lib/api';
import { isOriginal } from '@/lib/display';
import { toGridItem, wallOrder } from '@/lib/grid-items';

// Strapi's "Original Art" category has the slug "category" (see Layout).
export const ORIGINALS_SLUG = 'category';
export const PER_PAGE = 16;

// Copy for each category; Strapi's own descriptions are placeholders.
const INTROS: Record<string, { eyebrow: string; title?: string; intro: string }> = {
  [ORIGINALS_SLUG]: {
    eyebrow: 'Original art',
    title: 'Originals',
    intro: 'One-of-a-kind paintings and drawings, hung salon style. Once one finds a home, it’s gone. Free shipping within Canada.',
  },
  books: { eyebrow: 'Shop', intro: 'Art books and sketch collections.' },
  merch: { eyebrow: 'Shop', intro: 'Shirts, stickers and other things with drawings on them.' },
};

export default async function CategoryListing({ slug, page }: { slug: string; page: number }) {
  const [category, categories, globalSettings] = await Promise.all([
    fetchCategoryBySlug(slug),
    fetchCategoriesWithProducts(),
    fetchGlobal(),
  ]);
  if (!category) notFound();

  const copy = INTROS[slug];
  const header = {
    categories,
    trail: [[copy?.title ?? category.name]] as Array<[string, string?]>,
    eyebrow: copy?.eyebrow,
    title: copy?.title ?? category.name,
    intro: copy?.intro ?? category.description,
  };

  // Originals: every piece on the salon wall (it pages itself, with filters), not a card grid.
  if (slug === ORIGINALS_SLUG) {
    const items = (await fetchProducts()).filter(isOriginal).sort(wallOrder).map(toGridItem);
    return (
      <ListingPage
        {...header}
        wall={
          <div className="salon-room">
            <section className="mx-auto max-w-7xl px-4 sm:px-8 pt-14 sm:pt-16 pb-20">
              <OriginalsGrid items={items} heading="On the wall" posterPrice={globalSettings.posterPrice} />
            </section>
          </div>
        }
      />
    );
  }

  const { products, pagination } = await fetchProductsByCategoryPaginated(slug, page, PER_PAGE);
  if (page > Math.max(1, pagination.pageCount)) notFound();
  return (
    <ListingPage {...header} pagination={{ ...pagination, baseUrl: `/category/${category.slug}` }}>
      <ProductGrid products={products} />
    </ListingPage>
  );
}
