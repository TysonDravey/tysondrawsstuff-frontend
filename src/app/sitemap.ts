import { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';
import { fetchProductSlugs, fetchShowSlugs, fetchCategories } from '@/lib/api';

// Revalidate sitemap every hour
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  try {
    // Fetch all dynamic content
    const [productSlugs, showSlugs, categories] = await Promise.all([
      fetchProductSlugs().catch(() => []),
      fetchShowSlugs().catch(() => []),
      fetchCategories().catch(() => [])
    ]);

    const urls: MetadataRoute.Sitemap = [
      // Static pages
      {
        url: siteUrl(),
        lastModified: now,
        changeFrequency: 'daily',
        priority: 1.0,
      },
      {
        url: siteUrl(`/shop`),
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.9,
      },
      {
        url: siteUrl(`/about`),
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: siteUrl(`/shows`),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: siteUrl(`/posters`),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      },
    ];

    // Add product pages
    productSlugs.forEach((slug) => {
      urls.push({
        url: siteUrl(`/shop/${slug}`),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    });

    // Add show pages
    showSlugs.forEach((slug) => {
      urls.push({
        url: siteUrl(`/shows/${slug}`),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    });

    // Add category pages
    categories.forEach((category) => {
      urls.push({
        url: siteUrl(`/category/${category.slug}`),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    });

    console.log(`Sitemap generated with ${urls.length} URLs`);
    return urls;

  } catch (error) {
    console.error('Error generating sitemap:', error);

    // Return minimal sitemap if API calls fail
    return [
      {
        url: siteUrl(),
        lastModified: now,
        changeFrequency: 'daily',
        priority: 1.0,
      },
      {
        url: siteUrl(`/shop`),
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.9,
      },
      {
        url: siteUrl(`/about`),
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
      },
    ];
  }
}
