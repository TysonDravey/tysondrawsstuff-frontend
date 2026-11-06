import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import Script from "next/script";
import GaPageView from "@/components/GaPageView";
import "./globals.css";
import { siteUrl, SITE_URL, IS_PRODUCTION_SITE } from '@/lib/site';

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});


export const metadata: Metadata = {
  title: "Tyson Draws Stuff | Original Art, Prints, and Books",
  description: "Explore original art, posters, merch, and books by Tyson Brillon. Unique artwork and prints available for purchase.",
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Tyson Draws Stuff | Original Art, Prints, and Books",
    description: "Explore original art, posters, merch, and books by Tyson Brillon. Unique artwork and prints available for purchase.",
    url: siteUrl(),
    siteName: "Tyson Draws Stuff",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Tyson Draws Stuff",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tyson Draws Stuff | Original Art, Prints, and Books",
    description: "Explore original art, posters, merch, and books by Tyson Brillon. Unique artwork and prints available for purchase.",
    images: ["/images/og-default.jpg"],
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
        className={`${nunito.variable} ${nunitoSans.variable} antialiased`}
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
