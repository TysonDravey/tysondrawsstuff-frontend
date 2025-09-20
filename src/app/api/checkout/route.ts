import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { fetchProductBySlug } from '@/lib/api';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productSlug } = body;

    if (!productSlug) {
      return NextResponse.json(
        { error: 'Product slug is required' },
        { status: 400 }
      );
    }

    // Fetch product from Strapi
    const product = await fetchProductBySlug(productSlug);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Convert CAD to cents for Stripe
    const priceInCents = Math.round(product.price * 100);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: product.title,
              description: product.description ? product.description.replace(/<[^>]*>/g, '') : undefined,
              images: product.images && product.images.length > 0
                ? [`${process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1339'}${product.images[0].url}`]
                : undefined,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${request.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/cancel`,
      metadata: {
        productId: product.documentId,
        productSlug: product.slug,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}