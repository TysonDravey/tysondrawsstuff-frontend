'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

// Extend the global window object to include gtag
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

export default function GaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only track if GA ID is present and gtag is available
    const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
    if (!GA_ID || typeof window.gtag !== 'function') {
      return;
    }

    // Construct the full URL
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

    // Send page view event to GA4
    window.gtag('config', GA_ID, {
      page_title: document.title,
      page_location: window.location.href,
      page_path: url,
    });

    // Also send a specific page_view event for better tracking
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: url,
    });

    console.log('GA4 Page view tracked:', url);
  }, [pathname, searchParams]);

  return null;
}