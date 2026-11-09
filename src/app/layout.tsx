import type { Metadata } from "next";
import { Alfa_Slab_One, Inter } from "next/font/google";
import Script from "next/script";
import GaPageView from "@/components/GaPageView";
import "./globals.css";
import "./frames.css";
import { siteUrl, SITE_URL, IS_PRODUCTION_SITE } from '@/lib/site';

// Headings: Alfa Slab One. Everything else: Inter. Both self-hosted by next/font, so no flash of fallback text.
const alfa = Alfa_Slab_One({
  variable: "--font-alfa",
  subsets: ["latin"],
  weight: "400",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "Tyson Draws Stuff | Original Art, Prints, and Books",
  description: "Original paintings, poster prints, books and merch by Kirk Brillon. Free shipping within Canada.",
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  openGraph: {
    title: "Tyson Draws Stuff | Original Art, Prints, and Books",
    description: "Original paintings, poster prints, books and merch by Kirk Brillon. Free shipping within Canada.",
    url: siteUrl(),
    siteName: "Tyson Draws Stuff",
    images: [
      {
        url: "/images/og-default.jpg?v=2",
        width: 1200,
        height: 630,
        alt: "Paintings by Tyson Draws Stuff hung on a gallery wall",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tyson Draws Stuff | Original Art, Prints, and Books",
    description: "Original paintings, poster prints, books and merch by Kirk Brillon. Free shipping within Canada.",
    images: ["/images/og-default.jpg?v=2"],
  },
  // Preview deployments must never be indexed; only the live site is.
  robots: IS_PRODUCTION_SITE
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      }
    : { index: false, follow: false },
  // Add `verification: { google: "<code>" }` here once Search Console gives a code.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Analytics only on the live site, so preview/testing visits don't count as real traffic.
  const GA_ID = IS_PRODUCTION_SITE ? process.env.NEXT_PUBLIC_GA_ID : undefined;

  return (
    <html lang="en">
      <body
        className={`${alfa.variable} ${inter.variable} antialiased`}
      >
        {/* Google Analytics 4 Scripts */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                // Page views are sent once per page by <GaPageView />. Letting config
                // send one too counted every first page load two or three times.
                gtag('config', '${GA_ID}', { send_page_view: false });
              `}
            </Script>
            <GaPageView />
          </>
        )}

        {children}
      </body>
    </html>
  );
}
// Trigger deployment - Tue, Sep 23, 2025  8:38:19 PM
