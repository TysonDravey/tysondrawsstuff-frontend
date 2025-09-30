import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { fetchProductBySlug } from '@/lib/api';

function initializeStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

export async function POST(request: NextRequest) {
  try {
    // Initialize Stripe only when the function is called
    const stripe = initializeStripe();

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

    // Create Stripe checkout session with comprehensive customer data collection
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

      // Customer information collection
      customer_creation: 'always',
      customer_email: undefined, // Allows customer to enter email

      // Collect customer details
      billing_address_collection: 'auto', // Optional billing address
      shipping_address_collection: {
        allowed_countries: ['CA', 'US'], // Adjust based on your shipping countries
      },

      // Phone number collection
      phone_number_collection: {
        enabled: true,
      },

      // Success and cancel URLs
      success_url: `${request.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/cancel`,

      // Enhanced metadata for order tracking
      metadata: {
        productId: product.documentId,
        productSlug: product.slug,
        productTitle: product.title,
        productPrice: product.price.toString(),
        // GA4 product data for purchase tracking
        products: JSON.stringify([{
          item_id: product.slug,
          item_name: product.title,
          price: product.price,
          quantity: 1,
        }]),
      },

      // Custom fields for additional information (optional)
      custom_fields: [
        {
          key: 'order_notes',
          label: { type: 'custom', custom: 'Special instructions (optional)' },
          type: 'text',
          optional: true,
        },
      ],
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