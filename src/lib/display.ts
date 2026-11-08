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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "Nov 4 – Jan 29". Dates are plain YYYY-MM-DD from Strapi; parse them without a timezone shift.
export function showDates(show: Show): string {
  const fmt = (d: string) => {
    const [, m, day] = d.split('-').map(Number);
    return `${MONTHS[m - 1]} ${day}`;
  };
  return `${fmt(show.startDate)} – ${fmt(show.endDate)}`;
}
