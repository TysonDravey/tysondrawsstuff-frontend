const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1339';

export interface StrapiImage {
  id: number;
  url: string;
  alternativeText?: string;
  width: number;
  height: number;
}

export interface Product {
  id: number;
  documentId: string;
  title: string;
  price: number;
  description?: string;
  slug: string;
  images?: StrapiImage[];
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
  const response = await fetch(`${STRAPI_URL}/api/products?populate=*`);

  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }

  const result: StrapiResponse<Product[]> = await response.json();
  return result.data;
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const response = await fetch(`${STRAPI_URL}/api/products?filters[slug][$eq]=${slug}&populate=*`);

  if (!response.ok) {
    throw new Error('Failed to fetch product');
  }

  const result: StrapiResponse<Product[]> = await response.json();
  return result.data.length > 0 ? result.data[0] : null;
}

export async function fetchProductSlugs(): Promise<string[]> {
  const response = await fetch(`${STRAPI_URL}/api/products?fields[0]=slug`);

  if (!response.ok) {
    throw new Error('Failed to fetch product slugs');
  }

  const result: StrapiResponse<Product[]> = await response.json();
  return result.data.map(product => product.slug);
}

export function getStrapiImageUrl(image: StrapiImage): string {
  if (image.url.startsWith('http')) {
    return image.url;
  }
  return `${STRAPI_URL}${image.url}`;
}