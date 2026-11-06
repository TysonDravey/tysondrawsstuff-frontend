'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

// Extend the global window object to include gtag
declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: Record<string, unknown>) => void;
  }
}

function GaPageViewComponent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only track if GA ID is present and gtag is available
    const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
    if (!GA_ID || typeof window.gtag !== 'function') {
      return;
    }

    // Never send the Stripe checkout session id to GA: /success?session_id=...
    // shows the buyer's name, address and phone to anyone holding that id.
    const params = new URLSearchParams(searchParams.toString());
    params.delete('session_id');
    const query = params.toString();
    const url = pathname + (query ? `?${query}` : '');

    // One page_view per page. (gtag('config') used to be called here too, which
    // sends its own page_view, so every page was counted at least twice.)
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.origin + url,
      page_path: url,
    });
  }, [pathname, searchParams]);

  return null;
}

export default function GaPageView() {
  return (
    <Suspense fallback={null}>
      <GaPageViewComponent />
    </Suspense>
  );
}