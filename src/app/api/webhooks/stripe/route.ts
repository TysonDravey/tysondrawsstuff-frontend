import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle checkout session completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      // Get expanded session with customer and line items
      const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['customer', 'line_items'],
      });

      // Save order to Strapi
      await saveOrderToStrapi(expandedSession);

      console.log('Order saved to Strapi:', session.id);
    } catch (error) {
      console.error('Error saving order to Strapi:', error);
      // Don't return error to Stripe - we don't want to retry failed saves
    }
  }

  return NextResponse.json({ received: true });
}

async function saveOrderToStrapi(session: Stripe.Checkout.Session) {
  const customer = session.customer as Stripe.Customer | null;
  const customerEmail = customer?.email || session.customer_email;
  const customerName = customer?.name;
  const shippingDetails = (session as any).shipping_details;
  const shippingAddress = shippingDetails?.address;

  // Get custom fields (order notes)
  const orderNotes = session.custom_fields?.find(field => field.key === 'order_notes')?.text?.value;

  // Extract product information from metadata
  const productSlug = session.metadata?.productSlug;

  // Find the product in Strapi to get the relation ID
  let productId = null;
  if (productSlug) {
    try {
      const productResponse = await fetch(
        `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/products?filters[slug][$eq]=${productSlug}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.STRAPI_API_TOKEN}`, // Add this to your .env
          },
        }
      );
      const productData = await productResponse.json();
      if (productData.data && productData.data.length > 0) {
        productId = productData.data[0].id;
      }
    } catch (error) {
      console.error('Error fetching product for order:', error);
    }
  }

  const orderData = {
    data: {
      stripeSessionId: session.id,
      stripeCustomerId: customer?.id || null,
      customerEmail,
      customerName,
      customerPhone: session.customer_details?.phone || null,
      shippingName: shippingDetails?.name || null,
      shippingAddress: shippingAddress ? {
        line1: shippingAddress.line1,
        line2: shippingAddress.line2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postal_code: shippingAddress.postal_code,
        country: shippingAddress.country,
      } : null,
      billingAddress: null, // Add if you collect billing address
      orderTotal: (session.amount_total || 0) / 100,
      currency: session.currency || 'cad',
      paymentStatus: 'paid',
      orderNotes: orderNotes || null,
      product: productId,
      productSnapshot: session.metadata ? {
        productId: session.metadata.productId,
        productSlug: session.metadata.productSlug,
        productTitle: session.metadata.productTitle,
        productPrice: session.metadata.productPrice,
      } : null,
    },
  };

  // Save to Strapi
  const strapiResponse = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.STRAPI_API_TOKEN}`,
    },
    body: JSON.stringify(orderData),
  });

  if (!strapiResponse.ok) {
    const errorText = await strapiResponse.text();
    throw new Error(`Failed to save order to Strapi: ${strapiResponse.status} ${errorText}`);
  }

  const savedOrder = await strapiResponse.json();
  return savedOrder;
}