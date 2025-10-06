import { MetadataRoute } from 'next';
import { fetchProductSlugs, fetchShowSlugs, fetchCategories } from '@/lib/api';

// Revalidate sitemap every hour
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Always use production domain for sitemap URLs
  const baseUrl = 'https://tysondrawsstuff.com';
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
        url: baseUrl,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/shop`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.9,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/shows`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      },
    ];

    // Add product pages
    productSlugs.forEach((slug) => {
      urls.push({
        url: `${baseUrl}/shop/${slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    });

    // Add show pages
    showSlugs.forEach((slug) => {
      urls.push({
        url: `${baseUrl}/shows/${slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    });

    // Add category pages (if they have their own pages)
    categories.forEach((category) => {
      urls.push({
        url: `${baseUrl}/shop?category=${category.slug}`,
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
        url: baseUrl,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/shop`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.9,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
      },
    ];
  }
}
