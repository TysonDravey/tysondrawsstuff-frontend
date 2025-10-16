import Link from 'next/link';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import { fetchCategoriesWithProducts } from '@/lib/api';


const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'https://tysondrawsstuff.com';
};

export const metadata: Metadata = {
  alternates: {
    canonical: `${getBaseUrl()}/cancel`,
  },
};

export default async function CancelPage() {
  const categories = await fetchCategoriesWithProducts();

  return (
    <Layout categories={categories}>
      <div className="py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto">
            <div className="mb-8">
              <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-border">
                <svg
                  className="w-10 h-10 text-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold font-display text-foreground mb-4">
                Payment Cancelled
              </h1>
              <p className="text-foreground/80 mb-8">
                Your payment was cancelled. No charges were made to your account. You can continue shopping or try again.
              </p>
            </div>

            <div className="space-y-4">
              <Link
                href="/shop"
                className="inline-block bg-primary text-primary-foreground py-3 px-6 rounded-lg hover:bg-accent transition-colors font-semibold"
              >
                Continue Shopping
              </Link>
              <br />
              <Link
                href="/"
                className="inline-block text-foreground/60 hover:text-foreground transition-colors"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}