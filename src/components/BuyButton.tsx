'use client';

import { useState } from 'react';

interface BuyButtonProps {
  productSlug: string;
  price: number;
}

export default function BuyButton({ productSlug, price }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleBuyNow = async () => {
    setLoading(true);

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

  const handleAddToCart = () => {
    // Placeholder for cart functionality
    alert('Add to cart functionality coming soon!');
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleBuyNow}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-lg hover:bg-orange-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : `Buy Now - $${price.toFixed(2)} CAD`}
      </button>

      <button
        onClick={handleAddToCart}
        className="w-full border border-border text-card-foreground py-3 px-6 rounded-lg hover:bg-muted transition-colors"
      >
        Add to Cart
      </button>
    </div>
  );
}