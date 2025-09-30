'use client';

import { useState } from 'react';

// Extend the global window object to include gtag
declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: Record<string, unknown>) => void;
  }
}

interface BuyButtonProps {
  productSlug: string;
  price: number;
  productTitle: string;
}

export default function BuyButton({ productSlug, price, productTitle }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);

  // Check if we're in test mode
  const isTestMode = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_');

  const handleBuyNow = async () => {
    setLoading(true);

    // Track GA4 begin_checkout event before redirecting to Stripe
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "begin_checkout", {
        currency: "CAD",
        value: price,
        items: [
          {
            item_id: productSlug,
            item_name: productTitle,
            price: price,
            quantity: 1,
          },
        ],
      });
      console.log('GA4 begin_checkout event sent:', { productSlug, productTitle, price });
    }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productSlug,
        }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        console.error('Error creating checkout session:', data.error);
        alert('Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleBuyNow}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-lg hover:bg-orange-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed relative"
      >
        {loading ? 'Processing...' : (
          <>
            Buy Now - ${price.toFixed(2)} CAD
            {isTestMode && (
              <span className="absolute top-1 right-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                TEST
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}