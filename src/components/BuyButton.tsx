'use client';

import { useEffect, useState } from 'react';

type Notice = { title: string; message: string; reloadOnClose: boolean };

const SOLD_NOTICE: Notice = {
  title: 'This original just sold',
  message: 'Sorry, someone bought this piece a moment ago. If it has a poster, that may still be available.',
  reloadOnClose: true,
};

const ERROR_NOTICE: Notice = {
  title: 'Something went wrong',
  message: "We couldn't start the checkout. Please try again in a moment.",
  reloadOnClose: false,
};

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
  variant?: 'original' | 'poster';
}

export default function BuyButton({ productSlug, price, productTitle, variant = 'original' }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const closeNotice = () => {
    // After a "just sold" notice, reload so the page shows the piece as sold.
    if (notice?.reloadOnClose) window.location.reload();
    setNotice(null);
  };

  useEffect(() => {
    if (!notice) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeNotice();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  // Check if we're in test mode
  const isTestMode = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_');

  const label = variant === 'poster'
    ? `Buy Poster - $${price.toFixed(2)} CAD`
    : `Buy Original - $${price.toFixed(2)} CAD`;

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
            item_variant: variant,
            price: price,
            quantity: 1,
          },
        ],
      });
      console.log('GA4 begin_checkout event sent:', { productSlug, productTitle, price, variant });
    }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productSlug,
          variant,
        }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (response.status === 409) {
        setNotice(SOLD_NOTICE);
      } else {
        console.error('Error creating checkout session:', data.error);
        setNotice(ERROR_NOTICE);
      }
    } catch (error) {
      console.error('Error:', error);
      setNotice(ERROR_NOTICE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleBuyNow}
        disabled={loading}
        className={`w-full py-3 px-6 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed relative transition-colors ${
          variant === 'poster'
            ? 'bg-[#BFA054] text-white hover:bg-[#A98E49]'
            : 'bg-primary text-primary-foreground hover:bg-orange-600'
        }`}
      >
        {loading ? 'Processing...' : (
          <>
            {label}
            {isTestMode && (
              <span className="absolute top-1 right-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                TEST
              </span>
            )}
          </>
        )}
      </button>

      {notice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={closeNotice}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="buy-notice-title"
            aria-describedby="buy-notice-message"
            className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="buy-notice-title" className="font-display text-xl font-bold text-foreground">
              {notice.title}
            </h2>
            <p id="buy-notice-message" className="mt-3 text-muted-foreground">
              {notice.message}
            </p>
            <button
              autoFocus
              onClick={closeNotice}
              className="mt-6 w-full rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-orange-600"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
