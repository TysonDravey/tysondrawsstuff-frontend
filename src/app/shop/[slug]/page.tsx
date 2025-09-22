import { notFound } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { fetchProductBySlug, fetchProductSlugs } from '@/lib/api';
import BuyButton from '@/components/BuyButton';
import ImageGallery from '@/components/ImageGallery';

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Revalidate every 60 seconds
export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await fetchProductSlugs();

  return slugs.map((slug) => ({
    slug: slug,
  }));
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    // During build time, if Strapi is not available, show a placeholder
    if (process.env.NODE_ENV === 'production') {
      return (
        <Layout>
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
    <Layout>
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
                  <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary">
                    ${product.price.toFixed(2)} <span className="text-sm sm:text-base text-muted-foreground font-normal">CAD</span>
                  </p>
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
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                </div>
              )}

              {/* Purchase Section */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-card-foreground">Purchase</h3>
                <BuyButton productSlug={product.slug} price={product.price} />
              </div>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}