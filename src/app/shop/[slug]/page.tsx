import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { fetchProductBySlug, fetchProductSlugs, getStrapiImageUrl } from '@/lib/api';
import BuyButton from '@/components/BuyButton';

interface ProductPageProps {
  params: {
    slug: string;
  };
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
  const product = await fetchProductBySlug(params.slug);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Images */}
        <div className="space-y-4">
          {product.images && product.images.length > 0 ? (
            <>
              <div className="aspect-square relative bg-gray-200 rounded-lg overflow-hidden">
                <Image
                  src={getStrapiImageUrl(product.images[0])}
                  alt={product.images[0].alternativeText || product.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              {product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.images.slice(1, 5).map((image, index) => (
                    <div key={image.id} className="aspect-square relative bg-gray-200 rounded overflow-hidden">
                      <Image
                        src={getStrapiImageUrl(image)}
                        alt={image.alternativeText || `${product.title} ${index + 2}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-gray-500">No images available</span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-4">{product.title}</h1>
            <p className="text-4xl font-bold text-green-600">${product.price.toFixed(2)}</p>
          </div>

          {product.description && (
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <div
                className="text-gray-700"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}

          <BuyButton productSlug={product.slug} price={product.price} />

          <div className="border-t pt-6 text-sm text-gray-600">
            <p><strong>Product ID:</strong> {product.documentId}</p>
            <p><strong>SKU:</strong> {product.slug}</p>
          </div>
        </div>
      </div>
    </div>
  );
}