import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

interface SuccessPageProps {
  searchParams: Promise<{
    session_id?: string;
  }>;
}

async function getCheckoutSession(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'line_items', 'payment_intent'],
    });
    return session;
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    return null;
  }
}

function SuccessContent({ session }: { session: Stripe.Checkout.Session | null }) {
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Order Not Found
          </h1>
          <p className="text-gray-600 mb-8">
            We couldn&apos;t find your order details. Please contact support if you need assistance.
          </p>
          <Link
            href="/shop"
            className="inline-block bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const customer = session.customer as Stripe.Customer | null;
  const customerEmail = customer?.email || session.customer_email;
  const customerName = customer?.name;
  const shippingAddress = session.shipping_details?.address;
  const shippingName = session.shipping_details?.name;

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Order Confirmed!
          </h1>
          <p className="text-gray-600">
            Thank you for your purchase. Your order details have been sent to your email.
          </p>
        </div>

        {/* Order Details */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Details</h2>

          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Customer Information</h3>
              <div className="text-sm text-gray-600">
                {customerName && <p className="font-medium">{customerName}</p>}
                {customerEmail && <p>{customerEmail}</p>}
                {session.customer_details?.phone && (
                  <p>{session.customer_details.phone}</p>
                )}
              </div>
            </div>

            {/* Shipping Address */}
            {shippingAddress && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Shipping Address</h3>
                <div className="text-sm text-gray-600">
                  {shippingName && <p className="font-medium">{shippingName}</p>}
                  <p>{shippingAddress.line1}</p>
                  {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
                  <p>
                    {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postal_code}
                  </p>
                  <p>{shippingAddress.country}</p>
                </div>
              </div>
            )}
          </div>

          {/* Payment Information */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900">Payment Method:</span>
              <span className="text-sm text-gray-600">Card ending in ****</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm font-medium text-gray-900">Total Paid:</span>
              <span className="text-lg font-semibold text-green-600">
                ${(session.amount_total! / 100).toFixed(2)} CAD
              </span>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">What Happens Next?</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Your order details have been sent to {customerEmail}</li>
            <li>• We&apos;ll prepare your artwork for shipping</li>
            <li>• You&apos;ll receive tracking information once shipped</li>
            <li>• Questions? Contact us with your order ID: <span className="font-mono">{session.id}</span></li>
          </ul>
        </div>

        {/* Actions */}
        <div className="text-center space-y-4">
          <Link
            href="/shop"
            className="inline-block bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold mr-4"
          >
            Continue Shopping
          </Link>
          <Link
            href="/"
            className="inline-block text-gray-600 hover:text-gray-800 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id } = await searchParams;

  if (!session_id) {
    redirect('/shop');
  }

  const session = await getCheckoutSession(session_id);

  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-pulse">Loading order details...</div>
      </div>
    }>
      <SuccessContent session={session} />
    </Suspense>
  );
}