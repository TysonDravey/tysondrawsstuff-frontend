import type Stripe from 'stripe';

/**
 * Originals are one of a kind. The `sold` flag in products-data.json only
 * updates after SOLD is ticked in Strapi and the site is rebuilt, so Stripe
 * itself is the up-to-the-minute record of whether an original has sold.
 *
 * Every original's PaymentIntent is tagged with this metadata key (value = the
 * product's Strapi documentId, which survives slug edits).
 */
export const ORIGINAL_METADATA_KEY = 'tds_original';

/** True if Stripe already has a successful payment for this original. */
export async function isOriginalSoldInStripe(stripe: Stripe, productId: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]+$/.test(productId)) return false; // keep the search query well-formed
  try {
    const result = await stripe.paymentIntents.search({
      query: `status:'succeeded' AND metadata['${ORIGINAL_METADATA_KEY}']:'${productId}'`,
      limit: 1,
    });
    return result.data.length > 0;
  } catch (error) {
    // Don't block sales because Stripe search hiccuped; the webhook still
    // cancels competing checkouts once one buyer pays.
    console.error('Could not check Stripe for an earlier sale of this original:', error);
    return false;
  }
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
    if (s.id === paidSessionId) continue;
    if (s.metadata?.variant !== 'original' || s.metadata?.productId !== productId) continue;
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
