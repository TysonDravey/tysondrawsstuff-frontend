import { FRAME_NAMES } from './frames';
import { describeOriginal } from './display';

/**
 * The frame setting to use for a product: when the piece comes in a real frame (its description's
 * details mention one, e.g. "Custom wood frame with resin inlays included") its photo already shows
 * that frame, so "auto" becomes "none". An explicit choice in Strapi is always kept.
 */
export function frameSetting(p: { frame?: string; description?: string }): string | undefined {
  const auto = !p.frame || p.frame === 'auto';
  if (auto && describeOriginal(p.description).details.some(d => /frame/i.test(d))) return 'none';
  return p.frame;
}

// Small, stable pseudo-random number (0..1) from a slug, so a painting always gets the same
// tilt, drop, size and frame, on every visit and every build.
export function seeded(slug: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

// Which display frame a painting gets (a .frame-* class from frames.css). A choice made in Strapi
// ("none" or a named frame) wins; "auto" or nothing picks one from the slug, so the home wall and
// the product page always agree.
export function frameFor(item: { slug: string; frame?: string }): string {
  if (item.frame === 'none' || (FRAME_NAMES as readonly string[]).includes(item.frame ?? '')) return item.frame!;
  return FRAME_NAMES[Math.floor(seeded(item.slug, 5) * FRAME_NAMES.length)];
}
