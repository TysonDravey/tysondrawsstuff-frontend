import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import nodemailer from 'nodemailer';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getProductImages } from '@/lib/images';
import { siteUrl } from '@/lib/site';
import { expireOtherOpenCheckouts } from '@/lib/original-sales';

function initializeStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

function getWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
  }
  return webhookSecret;
}

// Live sales link to the live dashboard; test-mode sales to the test one.
function stripeDashboardBase() {
  return process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
    ? 'https://dashboard.stripe.com'
    : 'https://dashboard.stripe.com/test';
}

// Email configuration
const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'orders@tysondrawsstuff.com',
  to: process.env.EMAIL_TO || 'kirkbrillon@gmail.com',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587'),
  smtpUser: process.env.SMTP_USER!,
  smtpPass: process.env.SMTP_PASS!,
};

// Create email transporter
function createEmailTransporter() {
  return nodemailer.createTransport({
    host: EMAIL_CONFIG.smtpHost,
    port: EMAIL_CONFIG.smtpPort,
    secure: EMAIL_CONFIG.smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: EMAIL_CONFIG.smtpUser,
      pass: EMAIL_CONFIG.smtpPass,
    },
  });
}

// Order data interface
interface OrderData {
  stripeSessionId: string;
  livemode: boolean;
  stripeCustomerId: string | null;
  orderDate: string;
  orderTotal: number;
  currency: string;
  paymentStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  productId: string;
  productTitle: string;
  productPrice: string;
  productSlug: string;
  variant: string;
  orderNotes: string;
}

// Save order to local JSON file (fallback logging)
async function saveOrderToLocalFile(orderData: OrderData) {
  try {
    const ordersDir = '/tmp';
    const ordersFile = path.join(ordersDir, 'orders.json');

    // Create tmp directory if it doesn't exist
    if (!existsSync(ordersDir)) {
      await mkdir(ordersDir, { recursive: true });
    }

    // Read existing orders or start with empty array
    let existingOrders: OrderData[] = [];
    if (existsSync(ordersFile)) {
      try {
        const fileContent = await import('fs/promises').then(fs => fs.readFile(ordersFile, 'utf8'));
        existingOrders = JSON.parse(fileContent);
      } catch {
        console.warn('Could not read existing orders file, starting fresh');
      }
    }

    // Add new order with timestamp
    const newOrder = {
      ...orderData,
      savedAt: new Date().toISOString(),
    };

    existingOrders.push(newOrder);

    // Write back to file
    await writeFile(ordersFile, JSON.stringify(existingOrders, null, 2));
    console.log('Order saved to local file:', ordersFile);

    return newOrder;
  } catch (error) {
    console.error('Error saving order to local file:', error);
    throw error;
  }
}

// Send GA4 purchase event via Measurement Protocol
async function sendGA4PurchaseEvent(session: Stripe.Checkout.Session) {
  try {
    const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
    const GA_API_SECRET = process.env.GA_API_SECRET;

    if (!GA_ID || !GA_API_SECRET) {
      console.log('GA4 purchase tracking skipped - missing environment variables');
      return;
    }

    // Parse products from metadata or fallback to single product
    let items;
    try {
      items = session.metadata?.products ? JSON.parse(session.metadata.products) : [
        {
          item_id: session.metadata?.productSlug || '',
          item_name: session.metadata?.productTitle || '',
          price: parseFloat(session.metadata?.productPrice || '0'),
          quantity: 1,
        },
      ];
    } catch (parseError) {
      console.warn('Could not parse GA4 products metadata, using fallback:', parseError);
      items = [
        {
          item_id: session.metadata?.productSlug || '',
          item_name: session.metadata?.productTitle || '',
          price: parseFloat(session.metadata?.productPrice || '0'),
          quantity: 1,
        },
      ];
    }

    const payload = {
      client_id: `stripe_${session.id}`,
      events: [
        {
          name: 'purchase',
          params: {
            transaction_id: session.id,
            currency: (session.currency || 'cad').toUpperCase(),
            value: (session.amount_total || 0) / 100, // Convert cents to dollars
            items: items,
          },
        },
      ],
    };

    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_ID}&api_secret=${GA_API_SECRET}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      console.log('GA4 purchase event sent successfully:', session.id);
      console.log('GA4 payload:', JSON.stringify(payload, null, 2));
    } else {
      console.error('GA4 purchase event failed:', response.status, response.statusText);
    }

    return true;
  } catch (error) {
    console.error('Error sending GA4 purchase event:', error);
    throw error;
  }
}

// Send a short notification for an in-person /market sale
async function sendMarketSaleNotificationEmail(session: Stripe.Checkout.Session) {
  const transporter = createEmailTransporter();

  const amount = ((session.amount_total || 0) / 100).toFixed(2);
  const currency = (session.currency || 'cad').toUpperCase();
  const market = session.metadata?.market;

  const mailOptions = {
    from: EMAIL_CONFIG.from,
    to: EMAIL_CONFIG.to,
    subject: `${session.livemode ? '' : '[TEST] '}🎫 Market Sale: $${amount} ${currency}`,
    text: `
Market Sale (in-person)

Amount: $${amount} ${currency}
${market ? `Market: ${market}\n` : ''}Payment ID: ${session.id}
Date: ${new Date().toLocaleString()}

View in Stripe: ${stripeDashboardBase()}/checkout/sessions/${session.id}
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log('Market sale notification email sent successfully');
}

// Escape customer-supplied text before putting it in the HTML email
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Send order notification email
async function sendOrderNotificationEmail(orderData: OrderData) {
  try {
    const transporter = createEmailTransporter();

    const customerInfo = `
Name: ${orderData.customerName || 'Not provided'}
Email: ${orderData.customerEmail}
Phone: ${orderData.customerPhone || 'Not provided'}
    `;

    const shippingInfo = orderData.shippingAddress ? `
Shipping Address:
${orderData.shippingAddress.name || orderData.customerName}
${orderData.shippingAddress.line1}
${orderData.shippingAddress.line2 || ''}
${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.postal_code}
${orderData.shippingAddress.country}
    ` : 'No shipping address provided';

    const variantLabel = orderData.variant === 'poster' ? 'Poster Print' : 'Original';

    const productInfo = `
Product: ${orderData.productTitle}
Type: ${variantLabel}
Price: $${orderData.productPrice} ${orderData.currency.toUpperCase()}
Product ID: ${orderData.productId}
Product Slug: ${orderData.productSlug}
    `;

    // Photo of the piece that sold, so it's obvious at a glance which one to pack.
    // Resized by Cloudinary to email size, as JPEG (some mail apps can't show WebP).
    const photoUrl = getProductImages(orderData.productSlug)[0]?.src;
    const emailPhotoUrl = photoUrl?.startsWith('https://res.cloudinary.com/')
      ? photoUrl.replace('/upload/', '/upload/w_600,c_limit,f_jpg,q_auto/')
      : null;
    const productPageUrl = siteUrl(`/shop/${orderData.productSlug}`);
    const photoBlock = emailPhotoUrl ? `
        <div class="section" style="text-align: center;">
            <a href="${escapeHtml(productPageUrl)}"><img src="${escapeHtml(emailPhotoUrl)}" alt="${escapeHtml(orderData.productTitle)}" width="300" style="max-width: 100%; height: auto; border-radius: 4px;"></a>
            <p style="margin: 8px 0 0;"><strong>${escapeHtml(orderData.productTitle)}</strong> (${variantLabel})</p>
        </div>` : '';

    const specialInstructions = orderData.orderNotes ? `
Special Instructions:
${orderData.orderNotes}
    ` : '';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #640006; color: #E89B3B; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .section { background-color: white; margin: 10px 0; padding: 15px; border-radius: 5px; border-left: 4px solid #E89B3B; }
        .amount { font-size: 24px; font-weight: bold; color: #640006; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    ${orderData.livemode ? '' : `<div style="background-color: #fde047; color: #000; padding: 12px; text-align: center; font-weight: bold; font-size: 18px;">
        TEST ORDER - no money was charged. Do not ship.
    </div>`}
    <div class="header">
        <h1>🎨 New Order - Tyson Draws Stuff</h1>
    </div>

    <div class="content">
        ${photoBlock}

        <div class="section">
            <h2>💰 Order Summary</h2>
            <p><strong>Order ID:</strong> ${orderData.stripeSessionId}</p>
            <p><strong>Item Type:</strong> ${variantLabel}</p>
            <p><strong>Total Amount:</strong> <span class="amount">$${orderData.orderTotal} ${orderData.currency.toUpperCase()}</span></p>
            <p><strong>Payment Status:</strong> ✅ PAID</p>
            <p><strong>Order Date:</strong> ${new Date(orderData.orderDate).toLocaleString()}</p>
        </div>

        <div class="section">
            <h2>👤 Customer Information</h2>
            <pre>${escapeHtml(customerInfo)}</pre>
        </div>

        <div class="section">
            <h2>📦 Shipping Information</h2>
            <pre>${escapeHtml(shippingInfo)}</pre>
        </div>

        <div class="section">
            <h2>🎨 Product Details</h2>
            <pre>${escapeHtml(productInfo)}</pre>
        </div>

        ${specialInstructions ? `<div class="section">
            <h2>📝 Special Instructions</h2>
            <pre>${escapeHtml(specialInstructions)}</pre>
        </div>` : ''}

        <div class="section">
            <h2>🔗 Links</h2>
            <p><a href="${stripeDashboardBase()}/checkout/sessions/${orderData.stripeSessionId}" target="_blank">View in Stripe Dashboard</a></p>
        </div>
    </div>

    <div class="footer">
        <p>This order notification was automatically generated by your Tyson Draws Stuff website.</p>
    </div>
</body>
</html>
    `;

    const mailOptions = {
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.to,
      subject: `${orderData.livemode ? '' : '[TEST] '}🎨 New Order: $${orderData.orderTotal} - ${orderData.productTitle} (${variantLabel})`,
      html: emailHtml,
      text: `
New Order Received!

Order ID: ${orderData.stripeSessionId}
Item Type: ${variantLabel}
Total: $${orderData.orderTotal} ${orderData.currency.toUpperCase()}
Customer: ${orderData.customerName} (${orderData.customerEmail})
Product: ${orderData.productTitle}

${customerInfo}
${shippingInfo}
${productInfo}
${specialInstructions}

View in Stripe: ${stripeDashboardBase()}/checkout/sessions/${orderData.stripeSessionId}
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Order notification email sent successfully');

    return true;
  } catch (error) {
    console.error('Error sending order notification email:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Initialize Stripe and get webhook secret only when the function is called
    const stripe = initializeStripe();
    const WEBHOOK_SECRET = getWebhookSecret();

    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session & {
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
        };

        console.log('Processing completed checkout session:', session.id);

        // Market (in-person) sales never collect shipping/product data, so
        // they get a short dedicated notification instead of the store's
        // order email, which would render mostly "undefined" fields.
        if (session.metadata?.sale_type === 'market') {
          try {
            await sendMarketSaleNotificationEmail(session);
          } catch (emailError) {
            console.error('Error sending market sale notification email:', emailError);
          }
          console.log('Market sale processed:', session.id);
          break;
        }

        // An original just sold: cancel anyone else's open checkout for it first,
        // before the slower email/analytics work below.
        if (session.metadata?.variant === 'original' && session.metadata?.productId) {
          try {
            await expireOtherOpenCheckouts(stripe, session.metadata.productId, session.id);
          } catch (expireError) {
            console.error('Could not expire competing checkouts:', expireError);
          }
        }

        // Always retrieve full session with all details expanded
        let fullSession = session;
        try {
          fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['customer', 'shipping_cost']
          });
        } catch (error) {
          console.warn('Could not retrieve full session, using webhook session:', error);
        }

        // Extract all order information
        const orderData = {
          // Stripe identifiers
          stripeSessionId: session.id,
          livemode: session.livemode,
          stripeCustomerId: session.customer as string || null,

          // Order details
          orderDate: new Date().toISOString(),
          orderTotal: (session.amount_total || 0) / 100, // Convert cents to dollars
          currency: session.currency || 'cad',
          paymentStatus: 'paid',

          // Customer information
          customerName: fullSession.customer_details?.name || '',
          customerEmail: fullSession.customer_details?.email || '',
          customerPhone: fullSession.customer_details?.phone || '',

          // Shipping information - found in customer_details.address!
          shippingAddress: (() => {
            // Where to SHIP. Since the 2025 "basil" Stripe API this lives in
            // collected_information.shipping_details. customer_details.address is
            // the BILLING address - only a last resort, since a buyer can ship
            // somewhere else (e.g. a gift).
            const shipping = fullSession.collected_information?.shipping_details;
            if (shipping?.address) {
              return {
                name: shipping.name || fullSession.customer_details?.name || undefined,
                line1: shipping.address.line1 || undefined,
                line2: shipping.address.line2 || undefined,
                city: shipping.address.city || undefined,
                state: shipping.address.state || undefined,
                postal_code: shipping.address.postal_code || undefined,
                country: shipping.address.country || undefined,
              };
            }

            if (fullSession.customer_details?.address) {
              const addr = fullSession.customer_details.address;
              return {
                name: fullSession.customer_details.name || undefined,
                line1: addr.line1 || undefined,
                line2: addr.line2 || undefined,
                city: addr.city || undefined,
                state: addr.state || undefined,
                postal_code: addr.postal_code || undefined,
                country: addr.country || undefined,
              };
            }

            // Fallback: try shipping_details.address (if it exists)
            if (fullSession.shipping_details?.address) {
              return {
                name: fullSession.shipping_details.name || fullSession.customer_details?.name || undefined,
                line1: fullSession.shipping_details.address.line1 || undefined,
                line2: fullSession.shipping_details.address.line2 || undefined,
                city: fullSession.shipping_details.address.city || undefined,
                state: fullSession.shipping_details.address.state || undefined,
                postal_code: fullSession.shipping_details.address.postal_code || undefined,
                country: fullSession.shipping_details.address.country || undefined,
              };
            }

            return null;
          })(),

          // Product information from metadata
          productId: session.metadata?.productId || '',
          productTitle: session.metadata?.productTitle || '',
          productPrice: session.metadata?.productPrice || '0',
          productSlug: session.metadata?.productSlug || '',
          variant: session.metadata?.variant || 'original',

          // Order notes from custom fields
          orderNotes: session.custom_fields?.find(field => field.key === 'order_notes')?.text?.value || '',
        };

        // Send email notification (primary goal)
        await sendOrderNotificationEmail(orderData);

        // Send GA4 purchase event
        try {
          await sendGA4PurchaseEvent(session);
        } catch (gaError) {
          console.warn('GA4 purchase tracking failed (non-critical):', gaError);
        }

        // Save order locally (for backup/logging) - optional
        try {
          await saveOrderToLocalFile(orderData);
        } catch (fileError) {
          console.warn('Could not save order to local file (non-critical):', fileError);
        }

        console.log('Order processed successfully:', session.id);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', paymentIntent.id);

        // Could send failure notification email here if needed
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);

    // Fail so Stripe retries (it does for up to 3 days and shows the failure in
    // the dashboard). Answering 200 here meant a failed order email was simply
    // lost: the sale happened and nobody was told.
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
  } catch (initError) {
    console.error('Failed to initialize Stripe:', initError);
    return NextResponse.json(
      { error: 'Configuration error' },
      { status: 500 }
    );
  }
}