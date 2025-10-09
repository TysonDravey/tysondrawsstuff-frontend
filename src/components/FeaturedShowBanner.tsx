'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Show, Product } from '@/lib/api';
import { getStaticAssetUrl, getProductImageUrl } from '@/lib/images';

interface FeaturedShowBannerProps {
  show: Show;
  products: Product[];
}

export default function FeaturedShowBanner({ show, products }: FeaturedShowBannerProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Auto-advance the gallery every 3 seconds
  useEffect(() => {
    if (products.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % products.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [products.length]);

  const formatDateRange = (startDate: string, endDate: string) => {
    // Parse dates as UTC to avoid timezone issues
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })} - ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
    }

    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
  };

  return (
    <section className="py-12 bg-gradient-to-br from-red-50 to-rose-50 border-y border-red-200">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="inline-block bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-full mb-4">
              🎨 CURRENT SHOW
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              {show.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Show Logo */}
            {show.logo && (
              <div className="lg:col-span-1">
                <div className="aspect-square bg-white rounded-lg overflow-hidden shadow-lg border-2 border-red-200 relative max-w-xs mx-auto lg:mx-0">
                  <Image
                    src={getStaticAssetUrl(show.logo.url)}
                    alt={show.logo.alternativeText || show.title}
                    fill
                    className="object-contain p-4"
                  />
                </div>
              </div>
            )}

            {/* Show Info & Product Gallery */}
            <div className={show.logo ? 'lg:col-span-2' : 'lg:col-span-3'}>
              {/* Show Details */}
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-red-200">
                <div className="space-y-4">
                  {/* Location */}
                  {show.location && (
                    <div className="flex items-start space-x-3">
                      <svg className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <p className="font-semibold text-gray-900">Location</p>
                        <p className="text-gray-700">{show.location}</p>
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="font-semibold text-gray-900">Dates</p>
                      <p className="text-gray-700">{formatDateRange(show.startDate, show.endDate)}</p>
                    </div>
                  </div>

                  {/* View Show Button */}
                  <div className="pt-4">
                    <Link
                      href={`/shows/${show.slug}`}
                      className="inline-flex items-center justify-center w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                      View Show Details
                      <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Product Gallery */}
              {products.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-red-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                    Featured Artwork from this Show
                  </h3>

                  <Link href={`/shows/${show.slug}`} className="block">
                    <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4 hover:opacity-90 transition-opacity">
                      {products.map((product, index) => {
                        const firstImage = product.images?.[0];
                        if (!firstImage) return null;

                        return (
                          <div
                            key={product.id}
                            className={`absolute inset-0 transition-opacity duration-500 ${
                              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                            }`}
                          >
                            <Image
                              src={getProductImageUrl(product.slug, firstImage, 0)}
                              alt={product.title}
                              fill
                              className="object-contain p-4"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Product Info */}
                    {products[currentImageIndex] && (
                      <div className="text-center">
                        <p className="font-semibold text-gray-900 text-lg mb-1">
                          {products[currentImageIndex].title}
                        </p>
                        {products[currentImageIndex].showPrice ? (
                          <p className="text-red-600 font-bold text-xl">
                            Show Price: ${products[currentImageIndex].showPrice.toFixed(2)}
                          </p>
                        ) : (
                          <p className="text-gray-700 font-semibold">
                            ${products[currentImageIndex].price.toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}
                  </Link>

                  {/* Gallery Indicators */}
                  {products.length > 1 && (
                    <div className="flex justify-center space-x-2 mt-4">
                      {products.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === currentImageIndex
                              ? 'bg-red-600 w-8'
                              : 'bg-gray-300 hover:bg-gray-400'
                          }`}
                          aria-label={`View product ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
