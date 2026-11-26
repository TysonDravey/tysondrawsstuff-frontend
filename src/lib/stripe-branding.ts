import Stripe from 'stripe';

// Stripe's hosted checkout page dressed like the site (dark background, orange button, Inter)
// instead of Stripe's default bright white. Our SDK version predates `branding_settings`, hence
// the cast. Branding is cosmetic: if Stripe ever rejects it, retry plain rather than lose a sale.
// Used by both the shop checkout and the market Quick Pay checkout.
const BRANDING = {
  display_name: 'Tyson Draws Stuff',
  background_color: '#0E0B0A',
  button_color: '#E89B3B',
  border_style: 'rounded',
  font_family: 'inter',
};

export async function createBrandedSession(stripe: Stripe, params: Stripe.Checkout.SessionCreateParams) {
  try {
    return await stripe.checkout.sessions.create({
      ...params,
      branding_settings: BRANDING,
    } as Stripe.Checkout.SessionCreateParams);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError && /branding/i.test(`${error.param} ${error.message}`)) {
      console.warn('Stripe rejected checkout branding; creating the session without it:', error.message);
      return stripe.checkout.sessions.create(params);
    }
    throw error;
  }
}
