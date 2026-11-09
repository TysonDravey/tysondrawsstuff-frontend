import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Stripe from 'stripe';
import Layout from '@/components/Layout';
import { fetchCategoriesWithProducts, Category } from '@/lib/api';
import { siteUrl } from '@/lib/site';
import { getProductImages } from '@/lib/images';
import { displayTitle, formatPrice } from '@/lib/display';
import { isCutout } from '@/lib/frame-pick';

interface ExpandedSession extends Stripe.Checkout.Session {
  shipping_details?: {
    name?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export const metadata: Metadata = {
  title: 'Thank you | Tyson Draws Stuff',
  robots: { index: false },
  alternates: {
    canonical: siteUrl(`/success`),
  },
};

interface SuccessPageProps {
  searchParams: Promise<{
    session_id?: string;
  }>;
}

async function getCheckoutSession(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'line_items', 'payment_intent.payment_method'],
    });
    return session;
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    return null;
  }
}

// The piece they bought (from the checkout's metadata), for the "hung on the wall" moment.
function purchasedPiece(session: Stripe.Checkout.Session) {
  const slug = session.metadata?.productSlug;
  const v = session.metadata?.variant;
  return {
    title: displayTitle(session.metadata?.productTitle ?? ''),
    variant: (v === 'poster' || v === 'original' ? v : 'other') as 'poster' | 'original' | 'other',
    image: slug ? getProductImages(slug)[0] : undefined,
  };
}

const textLink = 'text-foreground font-semibold border-b border-primary hover:text-primary';
const button = 'bg-primary text-primary-foreground font-bold px-6 py-3 rounded hover:bg-[#F4B868] transition-colors';

function SuccessContent({ session, categories }: { session: ExpandedSession | null; categories: Category[] }) {
  if (!session) {
    return (
      <Layout categories={categories}>
        <div className="mx-auto max-w-2xl px-4 sm:px-8 py-24 text-center flex flex-col items-center gap-5">
          <p className="eyebrow">Order</p>
          <h1 className="font-display text-4xl leading-tight">We couldn’t find that order</h1>
          <p className="text-soft">
            If you’ve just paid, don’t worry: your receipt is on its way by email. Questions?{' '}
            <a href="mailto:kirkbrillon@gmail.com" className={textLink}>Email me</a>.
          </p>
          <Link href="/" className={`mt-2 ${button}`}>Back to the gallery</Link>
        </div>
      </Layout>
    );
  }

  const customer = session.customer as Stripe.Customer | null;
  const customerEmail = customer?.email || session.customer_email || session.customer_details?.email;
  const customerName = customer?.name || session.customer_details?.name;
  // Since the 2025 "basil" Stripe API, shipping lives in collected_information.
  const shipping = session.collected_information?.shipping_details ?? session.shipping_details;
  const shippingAddress = shipping?.address;
  const shippingName = shipping?.name;

  const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
  const paymentMethod = paymentIntent?.payment_method as Stripe.PaymentMethod | null;
  const card = paymentMethod?.card;
  const paymentLabel = card
    ? `${card.brand.charAt(0).toUpperCase()}${card.brand.slice(1)} ending in ${card.last4}`
    : paymentMethod?.type === 'link' ? 'Link' : 'Card';

  const piece = purchasedPiece(session);
  const firstName = (shippingName || customerName || '').trim().split(/\s+/)[0];
  const headline = { original: 'It’s yours.', poster: 'Your poster is on its way.', other: 'Thank you!' }[piece.variant];
  const lede = {
    original: `${piece.title || 'This piece'} is coming off the wall and heading to you. Thank you for giving it a home.`,
    poster: `A print of ${piece.title || 'the piece'} is heading your way. Thank you!`,
    other: 'Your order is confirmed. Thank you!',
  }[piece.variant];

  return (
    <Layout categories={categories}>
      <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-12 sm:pt-16 pb-20">
        <div className="grid gap-10 lg:gap-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start">
          {/* What they bought, hung on the wall */}
          {piece.image && (
            <div className="salon-room grid place-items-center px-8 py-12 sm:px-12 sm:py-14">
              <span className="lit block">
                <span className={`painting painting-fit ${isCutout(piece.image.src) ? 'painting-cutout' : ''} relative block`}>
                  <Image
                    src={piece.image.src}
                    alt={piece.image.alt || piece.title}
                    width={piece.image.width || 1200}
                    height={piece.image.height || 1600}
                    priority
                    sizes="(min-width: 1024px) 460px, 85vw"
                    className="block w-auto h-auto max-w-full max-h-[min(60vh,560px)]"
                  />
                  <span aria-hidden="true" className="painting-light" />
                </span>
              </span>
            </div>
          )}

          <div className={`flex flex-col gap-7 ${piece.image ? '' : 'lg:col-span-2 max-w-2xl'}`}>
            <div className="flex flex-col gap-4">
              <p className="eyebrow">Order confirmed{firstName ? ` · thanks, ${firstName}` : ''}</p>
              <h1 className="font-display text-4xl sm:text-[56px] leading-[1.05]">{headline}</h1>
              <p className="text-lg text-soft">{lede}</p>
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5 border-t border-border pt-6 text-sm">
              {shippingAddress && (
                <div>
                  <dt className="eyebrow mb-1.5">Shipping to</dt>
                  <dd className="text-soft leading-relaxed">
                    {shippingName && <span className="block text-foreground">{shippingName}</span>}
                    <span className="block">{shippingAddress.line1}</span>
                    {shippingAddress.line2 && <span className="block">{shippingAddress.line2}</span>}
                    <span className="block">
                      {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postal_code}
                    </span>
                  </dd>
                </div>
              )}
              <div>
                <dt className="eyebrow mb-1.5">Paid</dt>
                <dd className="text-soft leading-relaxed">
                  <span className="block text-foreground text-lg font-semibold">
                    {formatPrice((session.amount_total ?? 0) / 100)} CAD
                  </span>
                  <span className="block">{paymentLabel} · free shipping</span>
                </dd>
              </div>
              {customerEmail && (
                <div>
                  <dt className="eyebrow mb-1.5">Receipt sent to</dt>
                  <dd className="text-soft break-all">{customerEmail}</dd>
                </div>
              )}
            </dl>

            <div className="rounded border border-border bg-card p-5 sm:p-6">
              <h2 className="font-display text-xl mb-3">What happens next</h2>
              <ol className="text-sm text-soft space-y-2 list-decimal pl-5 marker:text-primary">
                <li>I pack it up carefully.</li>
                <li>It ships free within Canada, and you’ll get tracking by email once it’s on its way.</li>
                <li>
                  Questions? <a href="mailto:kirkbrillon@gmail.com" className={textLink}>Email me</a> with your order
                  number: <span className="font-mono text-xs text-foreground break-all">{session.id}</span>
                </li>
              </ol>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/" className={button}>Back to the gallery</Link>
              <a
                href="https://www.instagram.com/tyson_draws_stuff/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold border-b-2 border-primary pb-0.5 hover:text-primary"
              >
                Follow along on Instagram
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id } = await searchParams;

  if (!session_id) {
    redirect('/shop');
  }

  const [session, categories] = await Promise.all([
    getCheckoutSession(session_id),
    fetchCategoriesWithProducts(),
  ]);

  return (
    <Suspense fallback={<div className="py-24 text-center text-soft animate-pulse">Loading your order…</div>}>
      <SuccessContent session={session} categories={categories} />
    </Suspense>
  );
}
