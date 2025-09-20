import Link from 'next/link';
import Image from 'next/image';
import { fetchProducts, getStrapiImageUrl, type Product } from '@/lib/api';

// Revalidate every 60 seconds
export const revalidate = 60;

export default async function ShopPage() {
  const products = await fetchProducts();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shop</h1>

      {products.length === 0 ? (
        <p className="text-gray-600">No products available at the moment.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product: Product) => (
            <div key={product.id} className="border rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
              <Link href={`/shop/${product.slug}`}>
                <div className="aspect-square relative bg-gray-200">
                  {product.images && product.images.length > 0 ? (
                    <Image
                      src={getStrapiImageUrl(product.images[0])}
                      alt={product.images[0].alternativeText || product.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No image available
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h2 className="text-xl font-semibold mb-2 line-clamp-2">{product.title}</h2>
                  <p className="text-2xl font-bold text-green-600">${product.price.toFixed(2)}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}