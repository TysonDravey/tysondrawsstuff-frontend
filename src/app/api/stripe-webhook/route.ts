import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import nodemailer from 'nodemailer';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// Email configuration
const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'orders@tysondrawsstuff.com',
  to: process.env.EMAIL_TO || 'kirk@tysondrawsstuff.com',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587'),
  smtpUser: process.env.SMTP_USER!,
  smtpPass: process.env.SMTP_PASS!,
};

// Create email transporter
function createEmailTransporter() {
  return nodemailer.createTransporter({
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
  orderNotes: string;
}

// Save order to local JSON file (fallback logging)
async function saveOrderToLocalFile(orderData: OrderData) {
  try {
    const ordersDir = path.join(process.cwd(), 'tmp');
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

    const productInfo = `
Product: ${orderData.productTitle}
Price: $${orderData.productPrice} ${orderData.currency.toUpperCase()}
Product ID: ${orderData.productId}
Product Slug: ${orderData.productSlug}
    `;

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
    <div class="header">
        <h1>🎨 New Order - Tyson Draws Stuff</h1>
    </div>

    <div class="content">
        <div class="section">
            <h2>💰 Order Summary</h2>
            <p><strong>Order ID:</strong> ${orderData.stripeSessionId}</p>
            <p><strong>Total Amount:</strong> <span class="amount">$${orderData.orderTotal} ${orderData.currency.toUpperCase()}</span></p>
            <p><strong>Payment Status:</strong> ✅ PAID</p>
            <p><strong>Order Date:</strong> ${new Date(orderData.orderDate).toLocaleString()}</p>
        </div>

        <div class="section">
            <h2>👤 Customer Information</h2>
            <pre>${customerInfo}</pre>
        </div>

        <div class="section">
            <h2>📦 Shipping Information</h2>
            <pre>${shippingInfo}</pre>
        </div>

        <div class="section">
            <h2>🎨 Product Details</h2>
            <pre>${productInfo}</pre>
        </div>

        ${specialInstructions ? `<div class="section">
            <h2>📝 Special Instructions</h2>
            <pre>${specialInstructions}</pre>
        </div>` : ''}

        <div class="section">
            <h2>🔗 Links</h2>
            <p><a href="https://dashboard.stripe.com/test/payments/${orderData.stripeSessionId}" target="_blank">View in Stripe Dashboard</a></p>
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
      subject: `🎨 New Order: $${orderData.orderTotal} - ${orderData.productTitle}`,
      html: emailHtml,
      text: `
New Order Received!

Order ID: ${orderData.stripeSessionId}
Total: $${orderData.orderTotal} ${orderData.currency.toUpperCase()}
Customer: ${orderData.customerName} (${orderData.customerEmail})
Product: ${orderData.productTitle}

${customerInfo}
${shippingInfo}
${productInfo}
${specialInstructions}

View in Stripe: https://dashboard.stripe.com/test/payments/${orderData.stripeSessionId}
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
        const session = event.data.object as Stripe.Checkout.Session;

        console.log('Processing completed checkout session:', session.id);

        // Extract all order information
        const orderData = {
          // Stripe identifiers
          stripeSessionId: session.id,
          stripeCustomerId: session.customer as string || null,

          // Order details
          orderDate: new Date().toISOString(),
          orderTotal: (session.amount_total || 0) / 100, // Convert cents to dollars
          currency: session.currency || 'cad',
          paymentStatus: 'paid',

          // Customer information
          customerName: session.customer_details?.name || '',
          customerEmail: session.customer_details?.email || '',
          customerPhone: session.customer_details?.phone || '',

          // Shipping information
          shippingAddress: session.shipping_details?.address ? {
            name: session.shipping_details.name,
            line1: session.shipping_details.address.line1,
            line2: session.shipping_details.address.line2,
            city: session.shipping_details.address.city,
            state: session.shipping_details.address.state,
            postal_code: session.shipping_details.address.postal_code,
            country: session.shipping_details.address.country,
          } : null,

          // Product information from metadata
          productId: session.metadata?.productId || '',
          productTitle: session.metadata?.productTitle || '',
          productPrice: session.metadata?.productPrice || '0',
          productSlug: session.metadata?.productSlug || '',

          // Order notes from custom fields
          orderNotes: session.custom_fields?.find(field => field.key === 'order_notes')?.text?.value || '',
        };

        // Save order locally (for backup/logging)
        await saveOrderToLocalFile(orderData);

        // Send email notification
        await sendOrderNotificationEmail(orderData);

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

    // Return success to Stripe to prevent retries, but log the error
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 200 } // Return 200 to prevent Stripe retries
    );
  }
}