const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1339';

// Create a fetch function with timeout for build time
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export interface StrapiImage {
  id: number;
  url: string;
  alternativeText?: string;
  width: number;
  height: number;
}

export interface Category {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface Show {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  location?: string;
  startDate: string;
  endDate: string;
  logo?: StrapiImage;
  description?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface Product {
  id: number;
  documentId: string;
  title: string;
  price: number;
  description?: string;
  slug: string;
  featured: boolean;
  images?: StrapiImage[];
  category?: Category;
  currentShow?: Show;
  showPrice?: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface StrapiResponse<T> {
  data: T;
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/products?populate=*&pagination[limit]=100&sort[0]=updatedAt:desc`);

    if (!response.ok) {
      console.warn('Failed to fetch products, returning empty array');
      return [];
    }

    const result: StrapiResponse<Product[]> = await response.json();
    return result.data;
  } catch (error) {
    console.warn('Strapi not available during build for products, returning empty array', error instanceof Error ? error.message : '');
    return [];
  }
}

export async function fetchProductsPaginated(page: number = 1, limit: number = 16): Promise<{ products: Product[], pagination: { page: number, pageSize: number, pageCount: number, total: number } }> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/products?populate=*&pagination[page]=${page}&pagination[pageSize]=${limit}&sort[0]=updatedAt:desc`);

    if (!response.ok) {
      console.warn('Failed to fetch paginated products, returning empty array');
      return { products: [], pagination: { page: 1, pageSize: limit, pageCount: 0, total: 0 } };
    }

    const result: StrapiResponse<Product[]> = await response.json();
    return {
      products: result.data,
      pagination: result.meta.pagination || { page: 1, pageSize: limit, pageCount: 0, total: 0 }
    };
  } catch (error) {
    console.warn('Strapi not available during build for paginated products, returning empty array', error instanceof Error ? error.message : '');
    return { products: [], pagination: { page: 1, pageSize: limit, pageCount: 0, total: 0 } };
  }
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/products?filters[slug][$eq]=${slug}&populate=*`);

    if (!response.ok) {
      console.warn(`Failed to fetch product ${slug}, returning null`);
      return null;
    }

    const result: StrapiResponse<Product[]> = await response.json();
    return result.data.length > 0 ? result.data[0] : null;
  } catch (error) {
    console.warn(`Strapi not available during build for product ${slug}, returning null`, error instanceof Error ? error.message : '');
    return null;
  }
}

export async function fetchProductSlugs(): Promise<string[]> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/products?fields[0]=slug`);

    if (!response.ok) {
      console.warn('Failed to fetch product slugs, returning empty array');
      return [];
    }

    const result: StrapiResponse<Product[]> = await response.json();
    return result.data.map(product => product.slug);
  } catch (error) {
    console.warn('Strapi not available during build for slugs, returning empty array', error instanceof Error ? error.message : '');
    return [];
  }
}

export function getStrapiImageUrl(image: StrapiImage, format?: string): string {
  let url = image.url;

  // If requesting a specific format and image has formats
  if (format && url.includes('/uploads/')) {
    // For Strapi images, we can request different formats by modifying the URL
    const urlParts = url.split('.');
    const extension = urlParts.pop();
    const baseName = urlParts.join('.');

    // Try to get the format, fallback to original
    switch (format) {
      case 'large':
        url = `${baseName}_large.${extension}`;
        break;
      case 'medium':
        url = `${baseName}_medium.${extension}`;
        break;
      case 'small':
        url = `${baseName}_small.${extension}`;
        break;
      case 'thumbnail':
        url = `${baseName}_thumbnail.${extension}`;
        break;
      default:
        // Keep original URL
        break;
    }
  }

  // If URL is already absolute (http/https), return as-is
  if (url.startsWith('http')) {
    return url;
  }

  // For relative URLs, return as-is (they should be static files in /public)
  // This function is only called at build time, so static generation will work
  return url;
}

export async function fetchFeaturedProducts(): Promise<Product[]> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/products?populate=*&filters[featured][$eq]=true&sort[0]=updatedAt:desc`);

    if (!response.ok) {
      console.warn('Failed to fetch featured products, returning empty array');
      return [];
    }

    const result: StrapiResponse<Product[]> = await response.json();
    return result.data;
  } catch {
    console.warn('Strapi not available during build for featured products, returning empty array');
    return [];
  }
}

export async function fetchProductsByCategory(categorySlug: string): Promise<Product[]> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/products?populate=*&filters[category][slug][$eq]=${categorySlug}&sort[0]=updatedAt:desc`);

    if (!response.ok) {
      console.warn(`Failed to fetch products for category ${categorySlug}, returning empty array`);
      return [];
    }

    const result: StrapiResponse<Product[]> = await response.json();
    return result.data;
  } catch {
    console.warn(`Strapi not available during build for category ${categorySlug}, returning empty array`);
    return [];
  }
}

export async function fetchProductsByCategoryPaginated(categorySlug: string, page: number = 1, limit: number = 16): Promise<{ products: Product[], pagination: { page: number, pageSize: number, pageCount: number, total: number } }> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/products?populate=*&filters[category][slug][$eq]=${categorySlug}&pagination[page]=${page}&pagination[pageSize]=${limit}&sort[0]=updatedAt:desc`);

    if (!response.ok) {
      console.warn(`Failed to fetch paginated products for category ${categorySlug}, returning empty array`);
      return { products: [], pagination: { page: 1, pageSize: limit, pageCount: 0, total: 0 } };
    }

    const result: StrapiResponse<Product[]> = await response.json();
    return {
      products: result.data,
      pagination: result.meta.pagination || { page: 1, pageSize: limit, pageCount: 0, total: 0 }
    };
  } catch {
    console.warn(`Strapi not available during build for paginated category ${categorySlug}, returning empty array`);
    return { products: [], pagination: { page: 1, pageSize: limit, pageCount: 0, total: 0 } };
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/categories?sort=sortOrder:asc`);

    if (!response.ok) {
      console.warn('Failed to fetch categories, returning empty array');
      return [];
    }

    const result: StrapiResponse<Category[]> = await response.json();
    return result.data;
  } catch {
    console.warn('Strapi not available during build for categories, returning empty array');
    return [];
  }
}

export async function fetchCategoriesWithProducts(): Promise<Category[]> {
  try {
    // Get all categories (already sorted by sortOrder)
    const categories = await fetchCategories();

    // Filter categories that have products, maintaining sort order
    const categoriesWithProducts: Category[] = [];

    for (const category of categories) {
      const products = await fetchProductsByCategory(category.slug);
      if (products.length > 0) {
        categoriesWithProducts.push(category);
      }
    }

    // Categories are already sorted by sortOrder from fetchCategories
    return categoriesWithProducts;
  } catch {
    console.warn('Error fetching categories with products, returning empty array');
    return [];
  }
}

export async function fetchCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/categories?filters[slug][$eq]=${slug}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: StrapiResponse<Category[]> = await response.json();
    return result.data.length > 0 ? result.data[0] : null;
  } catch {
    console.warn(`Strapi not available during build for category ${slug}, returning null`);
    return null;
  }
}

// Show API functions
export async function fetchShows(): Promise<Show[]> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/shows?populate=*&sort=startDate:desc`);

    if (!response.ok) {
      console.warn('Failed to fetch shows, returning empty array');
      return [];
    }

    const result: StrapiResponse<Show[]> = await response.json();
    return result.data;
  } catch (error) {
    console.warn('Strapi not available during build for shows, returning empty array', error instanceof Error ? error.message : '');
    return [];
  }
}

export async function fetchShowBySlug(slug: string): Promise<Show | null> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/shows?filters[slug][$eq]=${slug}&populate=*`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: StrapiResponse<Show[]> = await response.json();
    return result.data.length > 0 ? result.data[0] : null;
  } catch {
    console.warn(`Strapi not available during build for show ${slug}, returning null`);
    return null;
  }
}

export async function fetchShowSlugs(): Promise<string[]> {
  try {
    const shows = await fetchShows();
    return shows.map(show => show.slug);
  } catch {
    console.warn('Error fetching show slugs, returning empty array');
    return [];
  }
}

export async function fetchProductsByShow(showSlug: string): Promise<Product[]> {
  try {
    const response = await fetchWithTimeout(`${STRAPI_URL}/api/products?populate=*&filters[currentShow][slug][$eq]=${showSlug}&sort[0]=updatedAt:desc`);

    if (!response.ok) {
      console.warn(`Failed to fetch products for show ${showSlug}, returning empty array`);
      return [];
    }

    const result: StrapiResponse<Product[]> = await response.json();
    return result.data;
  } catch {
    console.warn(`Strapi not available during build for show ${showSlug}, returning empty array`);
    return [];
  }
}