// schema.org data for Google (JSON-LD). It lets search results show a piece's price and whether
// it's available, and lets Google Merchant Center read products straight from the pages.
// Test a page at https://search.google.com/test/rich-results
import type { Product } from './api';
import { SITE_URL, siteUrl } from './site';
import { getProductImages } from './images';
import { displayTitle, isOriginal, activeShow, describeOriginal, plainExcerpt } from './display';

const BRAND = { '@type': 'Brand', name: 'Tyson Draws Stuff' };
const ARTIST = { '@type': 'Person', name: 'Kirk Brillon', url: siteUrl('/about') };

// Free shipping, Canada only (see api/checkout/route.ts).
const SHIPPING = {
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'CAD' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'CA' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 5, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 10, unitCode: 'DAY' },
  },
};

const absolute = (src: string) => (src.startsWith('http') ? src : `${SITE_URL}${src}`);

/** Plain-text description: the artist's story plus the details (medium, size, framing). */
export function productDescription(product: Product): string {
  if (isOriginal(product)) {
    const { story, details } = describeOriginal(product.description);
    const sentence = (t: string) => (/[.!?…]$/.test(t) ? t : `${t}.`);
    const text = [story, ...details].filter((t): t is string => !!t).map(sentence).join(' ');
    if (text) return text;
  }
  return plainExcerpt(product.description, 500) ?? `${displayTitle(product.title)} by Tyson Draws Stuff (Kirk Brillon).`;
}

export function productJsonLd(product: Product, posterPrice?: number) {
  const url = siteUrl(`/shop/${product.slug}`);
  const original = isOriginal(product);
  const show = activeShow(product);
  const images = getProductImages(product.slug).map(i => absolute(i.src));

  const offers: object[] = [
    {
      '@type': 'Offer',
      ...(original && product.hasPoster && { name: 'Original' }),
      url,
      priceCurrency: 'CAD',
      price: ((show && product.showPrice) || product.price).toFixed(2),
      itemCondition: 'https://schema.org/NewCondition',
      // While a piece hangs at a show it's sold there, not online.
      availability:
        product.sold === true
          ? 'https://schema.org/SoldOut'
          : show
            ? 'https://schema.org/InStoreOnly'
            : 'https://schema.org/InStock',
      shippingDetails: SHIPPING,
    },
  ];
  if (posterPrice) {
    offers.push({
      '@type': 'Offer',
      name: 'Poster print',
      url: `${url}#poster`,
      priceCurrency: 'CAD',
      price: posterPrice.toFixed(2),
      itemCondition: 'https://schema.org/NewCondition',
      availability: 'https://schema.org/InStock',
      shippingDetails: SHIPPING,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': original ? ['Product', 'VisualArtwork'] : 'Product',
    name: displayTitle(product.title),
    description: productDescription(product),
    url,
    sku: product.slug,
    image: images,
    brand: BRAND,
    ...(original && { creator: ARTIST }),
    ...(product.category && { category: product.category.name }),
    offers: offers.length === 1 ? offers[0] : offers,
  };
}

/** Who's behind the site (home page). */
export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: siteUrl(),
        name: 'Tyson Draws Stuff',
      },
      {
        '@type': ['Organization', 'OnlineStore'],
        '@id': `${SITE_URL}/#store`,
        name: 'Tyson Draws Stuff',
        url: siteUrl(),
        logo: `${SITE_URL}/brand/apple-touch-icon.png`,
        email: 'kirkbrillon@gmail.com',
        founder: ARTIST,
        sameAs: ['https://www.instagram.com/tyson_draws_stuff/', 'https://www.facebook.com/tysondrawsstuff'],
        areaServed: 'CA',
      },
    ],
  };
}

/** Render-ready <script> contents: JSON with "<" escaped so text can't close the tag. */
export function jsonLdHtml(data: object): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}
