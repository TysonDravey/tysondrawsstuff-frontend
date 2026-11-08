import type { Metadata } from 'next';
import CategoryListing, { ORIGINALS_SLUG } from '@/components/CategoryListing';
import { fetchCategories, fetchCategoryBySlug } from '@/lib/api';
import { siteUrl } from '@/lib/site';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await fetchCategoryBySlug(slug);
  const name = slug === ORIGINALS_SLUG ? 'Original Art' : category?.name ?? 'Shop';
  return {
    title: `${name} | Tyson Draws Stuff`,
    description:
      slug === ORIGINALS_SLUG
        ? 'Original paintings and drawings by Kirk Brillon (Tyson Draws Stuff). One of a kind, free shipping within Canada.'
        : `${name} by Tyson Draws Stuff.`,
    alternates: {
      canonical: siteUrl(`/category/${slug}`),
    },
  };
}

export async function generateStaticParams() {
  const categories = await fetchCategories();
  return categories.map(category => ({ slug: category.slug }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  return <CategoryListing slug={slug} page={1} />;
}
