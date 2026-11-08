import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';
import { type Product } from '@/lib/api';
import { getProductImages } from '@/lib/images';
import { ORIGINAL_METADATA_KEY, checkOriginalAvailability } from '@/lib/original-sales';

function initializeStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

function getProductBySlug(slug: string): Product | null {
  try {
    const productsPath = path.join(process.cwd(), 'public', 'products-data.json');
    const productsData = fs.readFileSync(productsPath, 'utf-8');
    const products: Record<string, Product> = JSON.parse(productsData);
    return products[slug] || null;
  } catch (error) {
    console.error('Error reading products data:', error);
    return null;
  }
}

function getSiteSettings(): { posterPrice?: number } {
  try {
    const settingsPath = path.join(process.cwd(), 'public', 'site-settings.json');
    const settingsData = fs.readFileSync(settingsPath, 'utf-8');
    return JSON.parse(settingsData);
  } catch (error) {
    console.error('Error reading site settings:', error);
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    // Initialize Stripe only when the function is called
    const stripe = initializeStripe();

    const body = await request.json();
    const { productSlug, variant = 'original' } = body;

    if (!productSlug) {
      return NextResponse.json(
        { error: 'Product slug is required' },
        { status: 400 }
      );
    }

    // Fetch product from static data (exported at build time)
    const product = getProductBySlug(productSlug);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    if (variant !== 'original' && variant !== 'poster') {
      return NextResponse.json({ error: 'Invalid variant' }, { status: 400 });
    }

    // Server-side availability checks — the product page hides these buttons,
    // but the API can be called directly, so it must enforce them itself.
    if (variant === 'original' && product.sold === true) {
      return NextResponse.json({ error: 'This original has been sold' }, { status: 409 });
    }
    if (variant === 'poster' && product.hasPoster !== true) {
      return NextResponse.json({ error: 'No poster available for this piece' }, { status: 400 });
    }
    // The sold flag above only updates on rebuild; Stripe knows about a sale right away,
    // and about someone else being partway through buying this original.
    if (variant === 'original') {
      const availability = await checkOriginalAvailability(stripe, product.documentId);
      if (availability === 'sold') {
        return NextResponse.json({ error: 'This original has been sold', reason: 'sold' }, { status: 409 });
      }
      if (availability === 'in_checkout') {
        return NextResponse.json(
          { error: 'Someone is checking out this original right now', reason: 'in_checkout' },
          { status: 409 }
        );
      }
    }

    // Determine price and product name based on variant
    let checkoutPrice = product.price;
    let productName = product.title;

    if (variant === 'poster') {
      // Read poster price from site settings
      const siteSettings = getSiteSettings();
      if (!siteSettings.posterPrice) {
        return NextResponse.json(
          { error: 'Poster pricing not configured' },
          { status: 400 }
        );
      }
      checkoutPrice = siteSettings.posterPrice;
      productName = `${product.title} (Poster)`;
    }

    // Convert CAD to cents for Stripe
    const priceInCents = Math.round(checkoutPrice * 100);
    if (!Number.isFinite(priceInCents) || priceInCents < 100) {
      return NextResponse.json({ error: 'Product is not available for purchase' }, { status: 400 });
    }

    const firstImage = getProductImages(product.slug)[0]?.src;
    const checkoutImage = firstImage?.startsWith('https://') ? firstImage : undefined;

    // Create Stripe checkout session with comprehensive customer data collection
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: productName,
              description: product.description ? product.description.replace(/<[^>]*>/g, '') : undefined,
              // Product photos are served from Cloudinary; Strapi's /uploads/ paths
              // don't exist on the live site, so Stripe showed a broken image.
              images: checkoutImage ? [checkoutImage] : undefined,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',

      // Originals: tag the payment so later checkouts can see this piece sold,
      // and expire abandoned checkouts after Stripe's minimum of 30 minutes.
      ...(variant === 'original' && {
        payment_intent_data: { metadata: { [ORIGINAL_METADATA_KEY]: product.documentId } },
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      }),

      // Customer information collection
      customer_creation: 'always',
      customer_email: undefined, // Allows customer to enter email

      // Collect customer details
      billing_address_collection: 'auto', // Optional billing address
      shipping_address_collection: {
        // Canada only (free shipping, built into the price). US orders were dropped in Nov 2026
        // over tariffs/customs; US visitors are pointed to email instead.
        allowed_countries: ['CA'],
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
        productPrice: checkoutPrice.toString(),
        variant: variant,
        // GA4 product data for purchase tracking
        products: JSON.stringify([{
          item_id: product.slug,
          item_name: productName,
          item_variant: variant,
          price: checkoutPrice,
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