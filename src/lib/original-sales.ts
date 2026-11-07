import type Stripe from 'stripe';

/**
 * Originals are one of a kind. The `sold` flag in products-data.json only
 * updates after SOLD is ticked in Strapi and the site is rebuilt, so Stripe
 * itself is the up-to-the-minute record of whether an original has sold or
 * is being bought right now.
 *
 * Every original's checkout carries metadata { productId, variant: 'original' },
 * and its PaymentIntent is tagged with ORIGINAL_METADATA_KEY = productId (the
 * Strapi documentId, which survives slug edits).
 */
export const ORIGINAL_METADATA_KEY = 'tds_original';

/** An open checkout younger than this blocks other buyers; older ones count as abandoned. */
export const CHECKOUT_HOLD_MINUTES = 15;

/** Recent checkouts are read directly (instant); older sales via Search (can lag ~1 min). */
const RECENT_WINDOW_SECONDS = 2 * 60 * 60;

export type OriginalAvailability = 'available' | 'sold' | 'in_checkout';

function isForOriginal(s: Stripe.Checkout.Session, productId: string) {
  return s.metadata?.variant === 'original' && s.metadata?.productId === productId;
}

/**
 * Decide whether a new checkout may start for this original:
 * - 'sold'        a payment already succeeded
 * - 'in_checkout' someone opened checkout in the last CHECKOUT_HOLD_MINUTES
 * - 'available'   otherwise (abandoned older checkouts are cancelled on the way)
 *
 * Stripe errors never block a sale; the webhook still cancels competing checkouts.
 */
export async function checkOriginalAvailability(
  stripe: Stripe,
  productId: string
): Promise<OriginalAvailability> {
  const now = Math.floor(Date.now() / 1000);
  let inCheckout = false;

  try {
    for await (const s of stripe.checkout.sessions.list({
      created: { gte: now - RECENT_WINDOW_SECONDS },
      limit: 100,
    })) {
      if (!isForOriginal(s, productId)) continue;
      if (s.status === 'complete' && s.payment_status === 'paid') return 'sold';
      if (s.status !== 'open') continue;
      if (s.created >= now - CHECKOUT_HOLD_MINUTES * 60) {
        inCheckout = true;
      } else {
        try {
          await stripe.checkout.sessions.expire(s.id);
          console.log(`Expired abandoned checkout ${s.id} for original ${productId}`);
        } catch (error) {
          console.error(`Could not expire abandoned checkout ${s.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Could not list recent checkouts for this original:', error);
  }

  if (/^[A-Za-z0-9_-]+$/.test(productId)) {
    try {
      const older = await stripe.paymentIntents.search({
        query: `status:'succeeded' AND metadata['${ORIGINAL_METADATA_KEY}']:'${productId}'`,
        limit: 1,
      });
      if (older.data.length > 0) return 'sold';
    } catch (error) {
      console.error('Could not search Stripe for an earlier sale of this original:', error);
    }
  }

  return inCheckout ? 'in_checkout' : 'available';
}

/**
 * After an original sells, cancel every other open checkout for the same piece,
 * so a second buyer who already had the payment page open can't complete it.
 */
export async function expireOtherOpenCheckouts(
  stripe: Stripe,
  productId: string,
  paidSessionId: string
): Promise<number> {
  let expired = 0;
  for await (const s of stripe.checkout.sessions.list({ status: 'open', limit: 100 })) {
    if (s.id === paidSessionId || !isForOriginal(s, productId)) continue;
    try {
      await stripe.checkout.sessions.expire(s.id);
      expired++;
      console.log(`Expired competing checkout ${s.id} for sold original ${productId}`);
    } catch (error) {
      console.error(`Could not expire competing checkout ${s.id}:`, error);
    }
  }
  return expired;
}
