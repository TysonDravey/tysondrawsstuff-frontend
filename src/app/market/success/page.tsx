import Link from 'next/link';
import type { Metadata } from 'next';
import Stripe from 'stripe';
import MarketLocalTime from '@/components/MarketLocalTime';

export const metadata: Metadata = {
  title: 'Payment Confirmed | Tyson Draws Stuff',
  robots: {
    index: false,
    follow: false,
  },
};

function initializeStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

// Derive a short, human-readable confirmation code from Stripe's own
// PaymentIntent ID. This is computed here from data Stripe returned for a
// verified, paid session — never from anything the browser supplied.
function confirmationCode(paymentIntentId: string): string {
  const alphanumeric = paymentIntentId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return alphanumeric.slice(-4);
}

interface VerifiedMarketPayment {
  amount: number;
  currency: string;
  createdEpoch: number;
  code: string;
}

async function verifyMarketPayment(sessionId: string): Promise<VerifiedMarketPayment | null> {
  const stripe = initializeStripe();

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
  } catch (error) {
    console.error('Error retrieving market checkout session:', error);
    return null;
  }

  // Only trust sessions that actually came from the market flow and that
  // Stripe confirms were paid. Never render PAID based on the URL alone.
  if (session.payment_status !== 'paid' || session.metadata?.sale_type !== 'market') {
    return null;
  }

  const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
  const paymentIntentId = paymentIntent?.id || session.id;

  return {
    amount: (session.amount_total || 0) / 100,
    currency: (session.currency || 'cad').toUpperCase(),
    createdEpoch: session.created,
    code: confirmationCode(paymentIntentId),
  };
}

interface MarketSuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function MarketSuccessPage({ searchParams }: MarketSuccessPageProps) {
  const { session_id } = await searchParams;

  const payment = session_id ? await verifyMarketPayment(session_id) : null;

  if (!payment) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center gap-6">
        <h1 className="text-3xl font-black uppercase text-white">
          Payment Not Found
        </h1>
        <p className="text-white/60 max-w-sm">
          We couldn&apos;t verify a payment for this link. If you just paid, check with the artist.
        </p>
        <Link
          href="/market"
          className="mt-2 py-4 px-8 rounded-full bg-[#E89B3B] text-black font-black uppercase tracking-wide"
        >
          Back to Market
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#E89B3B] flex items-center justify-center mb-6 animate-[pop_0.3s_ease-out]">
        <svg
          className="w-14 h-14 sm:w-16 sm:h-16 text-black"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={4}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-5xl sm:text-7xl font-black uppercase text-[#E89B3B] tracking-tight">
        Paid
      </h1>

      <p className="text-5xl sm:text-6xl font-black text-white mt-4">
        ${payment.amount.toFixed(2)}
      </p>
      <p className="text-white/50 font-bold uppercase tracking-wide text-sm mt-1">
        {payment.currency}
      </p>

      <div className="mt-6 flex items-center gap-4 text-white/70 font-bold uppercase tracking-wide text-sm">
        <span>
          <MarketLocalTime epochSeconds={payment.createdEpoch} />
        </span>
        <span className="text-white/30">•</span>
        <span>Payment #{payment.code}</span>
      </div>

      <div className="mt-10 pt-6 border-t border-white/10 w-full max-w-xs">
        <p className="text-white font-black uppercase tracking-[0.2em] text-lg">
          Tyson Draws Stuff
        </p>
        <p className="text-[#E89B3B] font-bold mt-1">Thank you!</p>
      </div>
    </div>
  );
}
