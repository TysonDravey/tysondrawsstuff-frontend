import type { Product, Show } from './api';

// Strapi titles carry a " - Original Art" suffix for the admin's benefit; the site shows the bare name.
export function displayTitle(title: string): string {
  return title.replace(/\s*-\s*Original Art\s*$/i, '').trim();
}

// The first paragraph of a description, used as a pull quote. Skips lines that are just specs
// (e.g. "This is acrylic paint on canvas. 30x40") so the quote stays the artist's voice.
export function pullQuote(description?: string, maxLength = 160): string | null {
  if (!description || typeof description !== 'string') return null;
  const first = description.split(/\n\s*\n/).map(p => p.trim()).find(Boolean);
  if (!first || first.length > maxLength) return null;
  return first;
}

// Leftovers from the Strapi rich-text editor: &nbsp; and a stray literal "**Bold**".
function clean(text: string): string {
  return text.replace(/&nbsp;/g, ' ').replace(/\*\*Bold\*\*/g, '').replace(/[ \t]+/g, ' ').trim();
}

// A line that reads like a spec (medium, size, framing) rather than part of the story.
const SPEC = /\d+\s*["”]?\s*[x×]\s*\d+|acrylic|ink\b|watercolou?r|canvas|paper|mixed media|multi media|pastel|\boil\b|gouache|frame|painting|pigment/i;

// "16x20" / 12" x16" → 16 × 20″
function prettySize(text: string): string {
  // The closing inch mark (and the space before it) is only eaten when there is one, so
  // "14x20 in a frame" keeps its space and "12x16 24x16" stays two sizes.
  return text.replace(/(\d+)\s*["”]?\s*[x×]\s*(\d+)(?:\s*["”])?/g, '$1 × $2″');
}

/**
 * Split an original's description into the artist's story (the "Sometimes…" line and any other
 * prose) and its details (medium, size, framing), e.g.
 *   "Sometimes your game just needs cover art.\n\nAcrylic on canvas\n16\"x20\""
 *   → { story: "Sometimes your game just needs cover art.", details: ["Acrylic on canvas", "16 × 20″"] }
 */
export function describeOriginal(description?: string): { story: string | null; details: string[] } {
  if (!description) return { story: null, details: [] };
  const lines = clean(description.replace(/\r/g, ''))
    .split(/\n+/)
    .map(clean)
    .filter(Boolean);
  const story: string[] = [];
  const details: string[] = [];
  for (const [i, line] of lines.entries()) {
    if (i > 0 && SPEC.test(line)) {
      // "This is acrylic paint on canvas. 30x40" → "Acrylic paint on canvas", "30 × 40″"
      for (const part of line.replace(/^this is\s+/i, '').split(/\.\s+(?=\d)/)) {
        const d = prettySize(part.replace(/\.$/, '').trim());
        const pretty = d && d.charAt(0).toUpperCase() + d.slice(1);
        if (pretty && !details.includes(pretty)) details.push(pretty);
      }
    } else {
      story.push(line);
    }
  }
  return { story: story.join(' ') || null, details };
}

export function isOriginal(product: Product): boolean {
  return product.category?.name === 'Original Art';
}

export function isAvailable(product: Product): boolean {
  return product.sold !== true;
}

export function formatPrice(amount: number): string {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

// Every show that is on right now (started, not yet ended), newest first.
// Dates are whole days, so a show is still "on" for all of its end date.
export function currentShows(shows: Show[], now = new Date()): Show[] {
  const today = now.toISOString().slice(0, 10);
  return shows
    .filter(s => s.startDate.slice(0, 10) <= today && s.endDate.slice(0, 10) >= today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

// The show a piece is hanging at right now, if any. A show holds the piece (for in-person sale)
// until the end of its last day.
export function activeShow(product: Product, now = new Date()): Show | null {
  const s = product.currentShow;
  return s && s.endDate.slice(0, 10) >= now.toISOString().slice(0, 10) ? s : null;
}

export type ShowStatus = 'upcoming' | 'current' | 'past';
// Whole days: a show is current from its first day through the end of its last.
export function showStatus(show: Show, now = new Date()): ShowStatus {
  const today = now.toISOString().slice(0, 10);
  if (show.startDate.slice(0, 10) > today) return 'upcoming';
  if (show.endDate.slice(0, 10) < today) return 'past';
  return 'current';
}

// "Sep 11 – Oct 31, 2026" / "Nov 4, 2026 – Jan 29, 2027"
export function showDatesLong(show: Show): string {
  const parts = (d: string) => d.slice(0, 10).split('-').map(Number);
  const [y1, m1, d1] = parts(show.startDate);
  const [y2, m2, d2] = parts(show.endDate);
  return y1 === y2
    ? `${MONTHS[m1 - 1]} ${d1} – ${MONTHS[m2 - 1]} ${d2}, ${y2}`
    : `${MONTHS[m1 - 1]} ${d1}, ${y1} – ${MONTHS[m2 - 1]} ${d2}, ${y2}`;
}

// Plain-text opening of a Markdown description, for cards ("### Heading" and **bold** stripped).
export function plainExcerpt(markdown: string | undefined, max = 180): string | null {
  if (!markdown) return null;
  const text = markdown
    .replace(/&nbsp;/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "Nov 4 – Jan 29". Dates are plain YYYY-MM-DD from Strapi; parse them without a timezone shift.
export function showDates(show: Show): string {
  const fmt = (d: string) => {
    const [, m, day] = d.split('-').map(Number);
    return `${MONTHS[m - 1]} ${day}`;
  };
  return `${fmt(show.startDate)} – ${fmt(show.endDate)}`;
}
