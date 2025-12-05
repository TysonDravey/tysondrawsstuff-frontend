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
    <section className="py-12 bg-[#8B0913] border-y border-[#640006]/20">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="inline-block bg-[#640006] text-white text-sm font-bold px-4 py-2 rounded-full mb-4">
              🎨 NEW SHOW
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#E89B28] mb-2">
              {show.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Show Logo & Info */}
            <div className="flex flex-col space-y-6">
              {/* Show Logo */}
              {show.logo && (
                <div className="aspect-square bg-white rounded-lg overflow-hidden shadow-lg border-2 border-[#640006]/20 relative">
                  <Image
                    src={getStaticAssetUrl(show.logo.url)}
                    alt={show.logo.alternativeText || show.title}
                    fill
                    className="object-contain p-4"
                  />
                </div>
              )}

              {/* Show Details */}
              <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-[#640006]/20">
                <div className="space-y-4">
                  {/* Dates */}
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-[#640006] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="font-semibold text-gray-900">Dates</p>
                      <p className="text-gray-700">{formatDateRange(show.startDate, show.endDate)}</p>
                    </div>
                  </div>

                  {/* Location */}
                  {show.location && (
                    <div className="flex items-start space-x-3">
                      <svg className="w-6 h-6 text-[#640006] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <p className="font-semibold text-gray-900">Location</p>
                        <p className="text-gray-700">{show.location}</p>
                      </div>
                    </div>
                  )}

                  {/* View Show Button */}
                  <div className="pt-4">
                    <Link
                      href={`/shows/${show.slug}`}
                      className="inline-flex items-center justify-center w-full bg-[#640006] hover:bg-[#800008] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                      View Show Details
                      <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Product Gallery */}
            {products.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-3 border-2 border-[#640006]/20 h-full flex flex-col justify-center">
                <Link href={`/shows/${show.slug}`} className="block">
                  <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden hover:opacity-90 transition-opacity">
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
                            className="object-contain p-2"
                          />
                        </div>
                      );
                    })}
                  </div>
                </Link>

                {/* Gallery Indicators */}
                {products.length > 1 && (
                  <div className="flex justify-center space-x-2 mt-3">
                    {products.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentImageIndex
                            ? 'bg-[#640006] w-8'
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
    </section>
  );
}
