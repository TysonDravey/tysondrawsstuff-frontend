'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { fetchCategoriesWithProducts, type Category } from '@/lib/api';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    const loadCategories = async () => {
      const fetchedCategories = await fetchCategoriesWithProducts();
      setCategories(fetchedCategories);
    };

    loadCategories();
  }, []);

  const isActiveLink = (href: string) => {
    if (href === '/' && pathname === '/') return true;
    if (href !== '/' && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 bg-background border-b border-border z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-foreground hover:text-primary transition-colors">
                Tyson Draws Stuff
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/"
                className={`font-medium transition-colors ${
                  isActiveLink('/') ? 'text-primary' : 'text-foreground hover:text-primary'
                }`}
              >
                Home
              </Link>
              <Link
                href="/shop"
                className={`font-medium transition-colors ${
                  isActiveLink('/shop') ? 'text-primary' : 'text-foreground hover:text-primary'
                }`}
              >
                Shop All
              </Link>

              {/* Categories Dropdown */}
              <div className="relative group">
                <button className="font-medium text-foreground hover:text-primary flex items-center transition-colors">
                  Categories
                  <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                <div className="absolute top-full left-0 mt-1 w-48 bg-card rounded-md shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-2">
                    {categories.map((category) => (
                      <Link
                        key={category.slug}
                        href={`/category/${category.slug}`}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          isActiveLink(`/category/${category.slug}`)
                            ? 'text-primary bg-muted'
                            : 'text-card-foreground hover:text-primary hover:bg-muted'
                        }`}
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <Link
                href="/about"
                className={`font-medium transition-colors ${
                  isActiveLink('/about') ? 'text-primary' : 'text-foreground hover:text-primary'
                }`}
              >
                About
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-foreground hover:text-primary focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-border">
              <div className="py-4 space-y-2">
                <Link
                  href="/"
                  className={`block py-2 font-medium transition-colors ${
                    isActiveLink('/') ? 'text-primary' : 'text-foreground hover:text-primary'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="/shop"
                  className={`block py-2 font-medium transition-colors ${
                    isActiveLink('/shop') ? 'text-primary' : 'text-foreground hover:text-primary'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Shop All
                </Link>

                {/* Mobile Categories */}
                <div className="pt-2">
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Categories
                  </div>
                  {categories.map((category) => (
                    <Link
                      key={category.slug}
                      href={`/category/${category.slug}`}
                      className={`block py-2 pl-4 text-sm transition-colors ${
                        isActiveLink(`/category/${category.slug}`)
                          ? 'text-primary'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>

                <Link
                  href="/about"
                  className={`block py-2 font-medium transition-colors ${
                    isActiveLink('/about') ? 'text-primary' : 'text-foreground hover:text-primary'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  About
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand Section */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-card-foreground">Tyson Draws Stuff</h3>
              <p className="text-muted-foreground">
                Original artwork, prints, and merchandise by artist Kirk Brillon.
              </p>
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h4 className="font-semibold text-card-foreground">Quick Links</h4>
              <div className="space-y-2">
                <Link href="/shop" className="block text-muted-foreground hover:text-primary transition-colors">
                  Shop All
                </Link>
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/category/${category.slug}`}
                    className="block text-muted-foreground hover:text-primary transition-colors"
                  >
                    {category.name}
                  </Link>
                ))}
                <Link href="/about" className="block text-muted-foreground hover:text-primary transition-colors">
                  About
                </Link>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h4 className="font-semibold text-card-foreground">Contact</h4>
              <div className="space-y-2 text-muted-foreground">
                <p>Email: kirk@tysondrawsstuff.com</p>
                <p>Follow us on social media for updates</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Tyson Draws Stuff. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}