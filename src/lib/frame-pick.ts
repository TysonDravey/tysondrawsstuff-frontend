import { FRAME_NAMES } from './frames';
import { describeOriginal } from './display';

/** Does the piece ship in a real frame of its own? (Its details mention one, e.g. the Krampus
 *  series' "Custom wood frame with resin inlays included".) Their photos show the painting only,
 *  so they still get a display frame; the product page just says the real one is different. */
export function comesFramed(p: { description?: string }): boolean {
  return describeOriginal(p.description).details.some(d => /frame/i.test(d));
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
