import { notFound } from 'next/navigation';
import Link from 'next/link';
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
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Product Not Available</h1>
          <p className="text-gray-600 mb-8">This product could not be loaded at the moment.</p>
          <Link href="/shop" className="text-blue-600 hover:text-blue-800">
            ← Back to Shop
          </Link>
        </div>
      );
    }
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/shop"
        className="text-blue-600 hover:text-blue-800 mb-6 inline-block"
      >
        ← Back to Shop
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
          {/* Title and Price */}
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 lg:mb-4 leading-tight">
              {product.title}
            </h1>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-green-600">
              ${product.price.toFixed(2)} <span className="text-sm sm:text-base text-gray-500 font-normal">CAD</span>
            </p>
          </div>

          {/* Description */}
          {product.description && (
            <div className="prose prose-sm sm:prose lg:prose-lg max-w-none">
              <h3 className="text-lg sm:text-xl font-semibold mb-3 text-gray-900">Description</h3>
              <div
                className="text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}

          {/* Purchase Section */}
          <div className="bg-gray-50 p-4 sm:p-6 rounded-lg">
            <BuyButton productSlug={product.slug} price={product.price} />
          </div>

          {/* Product Info */}
          <div className="border-t pt-6 text-sm text-gray-600 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <p><strong>Product ID:</strong> {product.documentId}</p>
              <p><strong>SKU:</strong> {product.slug}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}