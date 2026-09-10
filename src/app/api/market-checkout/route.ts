import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function initializeStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 2000;

export async function POST(request: NextRequest) {
  try {
    const stripe = initializeStripe();
    const body = await request.json();
    const { amount, market } = body;

    const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < MIN_AMOUNT || numericAmount > MAX_AMOUNT) {
      return NextResponse.json(
        { error: `Amount must be between $${MIN_AMOUNT} and $${MAX_AMOUNT}` },
        { status: 400 }
      );
    }

    // Round to the nearest cent to avoid floating point drift
    const amountInCents = Math.round(numericAmount * 100);
    const roundedAmount = (amountInCents / 100).toFixed(2);

    const metadata: Record<string, string> = {
      sale_type: 'market',
      source: 'market_qr',
      amount: roundedAmount,
    };

    if (typeof market === 'string' && market.trim()) {
      metadata.market = market.trim().slice(0, 100);
    }

    // Minimal, in-person checkout: no shipping, no phone, no billing address,
    // no custom fields. payment_method_types is left unset so Checkout
    // dynamically surfaces Apple Pay / Google Pay / Link / card based on
    // the customer's device and the Dashboard's enabled payment methods.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      submit_type: 'pay',
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: 'Tyson Draws Stuff — Market Purchase',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${request.nextUrl.origin}/market/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/market`,
      metadata,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating market checkout session:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', detail: message },
      { status: 500 }
    );
  }
}
