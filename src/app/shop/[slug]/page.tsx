import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import { fetchProductBySlug, fetchProductSlugs, fetchCategoriesWithProducts } from '@/lib/api';
import BuyButton from '@/components/BuyButton';
import ImageGallery from '@/components/ImageGallery';
import { getProductImages } from '@/lib/images';
import { marked } from 'marked';

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Static export - no revalidation needed

export async function generateStaticParams() {
  const slugs = await fetchProductSlugs();

  return slugs.map((slug) => ({
    slug: slug,
  }));
}

// Get the current deployment URL for metadata
const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'https://tysondrawsstuff.com';
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return {
      title: 'Product Not Found | Tyson Draws Stuff',
      description: 'This product could not be found.',
    };
  }

  // Get product images and use first one for OG image
  const productImages = getProductImages(slug, product.images || []);
  const firstImage = productImages[0];

  // Truncate description to ~150 characters for meta description
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
  const metaDescription = product.description
    ? stripHtml(product.description).substring(0, 150).trim() + (product.description.length > 150 ? '...' : '')
    : `Original artwork by Tyson Brillon - ${product.title}. Available for purchase.`;

  const baseUrl = getBaseUrl();
  const ogImage = firstImage?.src || '/images/og-default.jpg';
  const fullTitle = `${product.title} | Tyson Draws Stuff`;

  return {
    title: fullTitle,
    description: metaDescription,
    openGraph: {
      title: fullTitle,
      description: metaDescription,
      type: 'article',
      url: `${baseUrl}/shop/${slug}`,
      siteName: 'Tyson Draws Stuff',
      images: [
        {
          url: ogImage,
          width: firstImage?.width || 1200,
          height: firstImage?.height || 630,
          alt: product.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: metaDescription,
      images: [ogImage],
    },
    alternates: {
      canonical: `${baseUrl}/shop/${slug}`,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [product, categories] = await Promise.all([
    fetchProductBySlug(slug),
    fetchCategoriesWithProducts()
  ]);

  if (!product) {
    // During build time, if Strapi is not available, show a placeholder
    if (process.env.NODE_ENV === 'production') {
      return (
        <Layout categories={categories}>
          <div className="container mx-auto px-4 py-16 text-center">
            <h1 className="text-2xl font-bold mb-4 text-foreground">Product Not Available</h1>
            <p className="text-muted-foreground mb-8">This product could not be loaded at the moment.</p>
            <Link href="/shop" className="text-primary hover:text-orange-600 inline-flex items-center">
              <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Shop
            </Link>
          </div>
        </Layout>
      );
    }
    notFound();
  }

  return (
    <Layout categories={categories}>
      <div className="py-8">
        <div className="container mx-auto px-4">
          <Link
            href="/shop"
            className="text-primary hover:text-orange-600 mb-6 inline-flex items-center font-medium transition-colors"
          >
            <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Shop
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Product Images */}
            <div>
              <ImageGallery
                images={product.images || []}
                productTitle={product.title}
                productSlug={product.slug}
              />
            </div>

            {/* Product Details */}
            <div className="space-y-6 lg:space-y-8">
              {/* Product Info Card */}
              <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                {/* Title and Price */}
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 lg:mb-4 leading-tight text-card-foreground">
                    {product.title}
                  </h1>

                  {/* Show Badge if product is at a show */}
                  {product.currentShow && (
                    <div className="mb-4">
                      <Link
                        href={`/shows/${product.currentShow.slug}`}
                        className="inline-flex items-center bg-amber-100 text-amber-800 text-sm font-medium px-3 py-1 rounded-full border border-amber-200 hover:bg-amber-200 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Available at {product.currentShow.title}
                      </Link>
                    </div>
                  )}

                  {/* Pricing Display */}
                  {product.currentShow && product.showPrice ? (
                    <div className="space-y-2">
                      <p className="text-lg text-muted-foreground line-through">
                        Online Price: ${product.price.toFixed(2)} CAD
                      </p>
                      <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-amber-600">
                        Show Price: ${product.showPrice.toFixed(2)} <span className="text-sm sm:text-base text-muted-foreground font-normal">CAD</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary">
                      ${product.price.toFixed(2)} <span className="text-sm sm:text-base text-muted-foreground font-normal">CAD</span>
                    </p>
                  )}
                </div>

                {/* Category */}
                {product.category && (
                  <div>
                    <span className="inline-block bg-secondary text-secondary-foreground text-sm font-medium px-3 py-1 rounded">
                      {product.category.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-lg sm:text-xl font-semibold mb-4 text-card-foreground">Description</h3>
                  <div
                    className="text-muted-foreground leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: marked(product.description, {
                        breaks: true,
                        gfm: true,
                      }) as string
                    }}
                  />
                </div>
              )}

              {/* Purchase Section */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-card-foreground">
                  {product.sold ? 'Status' : product.currentShow ? 'Availability' : 'Purchase'}
                </h3>

                {product.sold ? (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <h4 className="font-medium text-red-800">This Artwork Has Been Sold</h4>
                          <p className="text-sm text-red-700 mt-1">
                            This piece has found its home and is no longer available for purchase.
                            Check out more available artwork in the shop!
                          </p>
                        </div>
                      </div>
                    </div>

                    <Link
                      href="/shop"
                      className="inline-flex items-center justify-center w-full bg-primary hover:bg-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Browse Available Artwork
                    </Link>
                  </div>
                ) : product.currentShow ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <h4 className="font-medium text-amber-800">Available at Show</h4>
                          <p className="text-sm text-amber-700 mt-1">
                            This artwork is currently available at <strong>{product.currentShow.title}</strong>.
                            Online purchasing is temporarily unavailable.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/shows/${product.currentShow.slug}`}
                      className="inline-flex items-center justify-center w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      View Show Details
                    </Link>
                  </div>
                ) : (
                  <BuyButton
                    productSlug={product.slug}
                    price={product.price}
                    productTitle={product.title}
                  />
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}