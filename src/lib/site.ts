// The one real address of the site. Canonical links, Open Graph URLs and the
// sitemap must all use this, never VERCEL_URL: on Vercel that is the address
// of one specific deployment (xyz.vercel.app), and pointing canonicals at it
// tells Google the real page lives somewhere else.
export const SITE_URL = 'https://www.tysondrawsstuff.com';

// Absolute URL for a path on the site, with the trailing slash the site uses
// (next.config.ts has trailingSlash: true), so it matches the served URL with
// no redirect.
export function siteUrl(path = '/'): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  const withTrailing = withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  return `${SITE_URL}${withTrailing}`;
}

// Only the real production deployment should be indexed. Preview deployments
// (develop, rebuild branches) get noindex so Google never sees duplicates.
export const IS_PRODUCTION_SITE = process.env.VERCEL_ENV === 'production';
