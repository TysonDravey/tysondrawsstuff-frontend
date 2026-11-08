'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { type Category } from '@/lib/api';

interface LayoutProps {
  children: React.ReactNode;
  categories?: Category[];
}

// Strapi's "Original Art" category has the slug "category"; it gets its own nav item ("Originals").
const ORIGINALS_SLUG = 'category';

export default function Layout({ children, categories = [] }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const otherCategories = categories.filter(c => c.slug !== ORIGINALS_SLUG && c.slug !== 'posters');
  const navItems = [
    { href: `/category/${ORIGINALS_SLUG}/`, label: 'Originals' },
    { href: '/posters/', label: 'Posters' },
    ...otherCategories.map(c => ({ href: `/category/${c.slug}/`, label: c.name })),
    { href: '/shows/', label: 'Shows' },
    { href: '/about/', label: 'About' },
  ];

  const isActive = (href: string) => pathname.replace(/\/?$/, '/').startsWith(href);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-6">
          <Link href="/" aria-label="Tyson Draws Stuff home" className="shrink-0 hover:opacity-85 transition-opacity">
            <Image
              src="/brand/tds-wordmark-dark.webp"
              alt="Tyson Draws Stuff"
              width={2529}
              height={219}
              priority
              className="h-[22px] sm:h-[28px] w-auto"
            />
          </Link>

          <nav aria-label="Main" className="hidden lg:flex items-center gap-8">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`text-sm font-semibold uppercase tracking-[0.08em] transition-colors ${
                  isActive(item.href) ? 'text-primary' : 'text-foreground hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setIsMenuOpen(open => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            className="lg:hidden w-11 h-11 grid place-items-center rounded border border-line-strong text-foreground hover:text-primary"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              {isMenuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>

        {isMenuOpen && (
          <nav id="mobile-menu" aria-label="Main" className="lg:hidden border-t border-border">
            <ul className="mx-auto max-w-7xl px-4 sm:px-8 py-3">
              {navItems.map(item => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={`block py-3 text-base font-semibold uppercase tracking-[0.08em] ${
                      isActive(item.href) ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-burgundy text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-12 flex flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <Image
              src="/brand/tds-wordmark-dark.webp"
              alt="Tyson Draws Stuff"
              width={2529}
              height={219}
              className="h-[28px] sm:h-[34px] w-auto"
            />
            <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3 font-semibold">
              {navItems.map(item => (
                <Link key={item.href} href={item.href} className="text-white hover:text-primary transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-6 border-t border-white/15 pt-6 text-sm text-[#F1DCCB]">
            <p>
              Questions or commissions:{' '}
              <a href="mailto:kirkbrillon@gmail.com" className="text-white underline decoration-primary underline-offset-4 hover:text-primary">
                kirkbrillon@gmail.com
              </a>
            </p>
            <div className="flex items-center gap-5">
              <a href="https://www.instagram.com/tyson_draws_stuff/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-white hover:text-primary transition-colors">
                <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
              </a>
              <a href="https://www.facebook.com/tysondrawsstuff" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-white hover:text-primary transition-colors">
                <svg aria-hidden="true" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <span>&copy; {new Date().getFullYear()} Tyson Draws Stuff</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
