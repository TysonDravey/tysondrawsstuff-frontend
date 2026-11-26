import Stripe from 'stripe';
import { SITE_URL } from '@/lib/site';

// Stripe's hosted checkout page dressed like the site (dark background, orange button, Inter,
// our wordmark) instead of Stripe's default bright white. Our SDK version predates
// `branding_settings`, hence the cast. Used by both the shop checkout and market Quick Pay.
const BRANDING = {
  display_name: 'Tyson Draws Stuff',
  background_color: '#0E0B0A',
  button_color: '#E89B3B',
  border_style: 'rounded',
  font_family: 'inter',
};

// Stripe fetches the image itself, so it must be a public URL: always the live site, even from
// previews or localhost. PNG (not webp/svg) so Stripe can read it; cream lettering for the dark page.
const LOGO = { type: 'url', url: `${SITE_URL}/brand/tds-wordmark-dark.png` };

function isBrandingError(error: unknown) {
  return error instanceof Stripe.errors.StripeInvalidRequestError && /branding|logo/i.test(`${error.param} ${error.message}`);
}

// Branding is cosmetic, so a rejection must never cost a sale: first drop just the logo, then
// fall back to Stripe's plain page.
export async function createBrandedSession(stripe: Stripe, params: Stripe.Checkout.SessionCreateParams) {
  const attempts = [{ ...BRANDING, logo: LOGO }, BRANDING];
  for (const branding_settings of attempts) {
    try {
      return await stripe.checkout.sessions.create({
        ...params,
        branding_settings,
      } as Stripe.Checkout.SessionCreateParams);
    } catch (error) {
      if (!isBrandingError(error)) throw error;
      console.warn('Stripe rejected checkout branding; retrying with less:', (error as Error).message);
    }
  }
  return stripe.checkout.sessions.create(params);
}
