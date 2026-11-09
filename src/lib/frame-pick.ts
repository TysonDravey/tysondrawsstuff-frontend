import { FRAME_NAMES } from './frames';
import { FLOAT_NAMES } from './frames-float';
import { describeOriginal } from './display';

/** Does the piece ship in a real frame of its own? (Its details mention one, e.g. the Krampus
 *  series' "Custom wood frame with resin inlays included".) Their photos show the painting only,
 *  so they still get a display frame; the product page just says the real one is different. */
export function comesFramed(p: { description?: string }): boolean {
  // "Framed in black wood" yes; "Unframed" / "Not framed" / "No frame" no.
  return describeOriginal(p.description).details.some(d => /frame/i.test(d) && !/unframed|not framed|no frame/i.test(d));
}

// Small, stable pseudo-random number (0..1) from a slug, so a painting always gets the same
// tilt, drop, size and frame, on every visit and every build.
export function seeded(slug: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** Painted on canvas (stretched canvas hangs in a floating frame, not a regular moulding). */
export function onCanvas(p: { description?: string }): boolean {
  return describeOriginal(p.description).details.some(d => /canvas/i.test(d));
}

const ALL_FRAMES: readonly string[] = [...FRAME_NAMES, ...FLOAT_NAMES];

// Which display frame a painting gets (a .frame-* class from frames.css / frames-float.css). A choice
// made in Strapi ("none" or a named frame) wins; "auto" or nothing picks one from the slug, so the
// home wall and the product page always agree: a floating frame for work on canvas, a regular one
// for everything else.
export function frameFor(item: { slug: string; frame?: string; description?: string }): string {
  if (item.frame === 'none' || ALL_FRAMES.includes(item.frame ?? '')) return item.frame!;
  const pool: readonly string[] = onCanvas(item) ? FLOAT_NAMES : FRAME_NAMES;
  return pool[Math.floor(seeded(item.slug, 5) * pool.length)];
}

/** A photo of the piece in its real frame, cut out from the wall (see FRAMED_CUTOUTS in images.ts). */
export function isCutout(src?: string): boolean {
  return !!src?.startsWith('/framed/');
}
