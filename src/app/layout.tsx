import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import Script from "next/script";
import GaPageView from "@/components/GaPageView";
import "./globals.css";

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

// Get the current deployment URL for metadata
const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'https://tysondrawsstuff.com';
};

export const metadata: Metadata = {
  title: "Tyson Draws Stuff | Original Art, Prints, and Books",
  description: "Explore original art, posters, merch, and books by Tyson Brillon. Unique artwork and prints available for purchase.",
  metadataBase: new URL(getBaseUrl()),
  openGraph: {
    title: "Tyson Draws Stuff | Original Art, Prints, and Books",
    description: "Explore original art, posters, merch, and books by Tyson Brillon. Unique artwork and prints available for purchase.",
    url: getBaseUrl(),
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
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code", // Replace with actual verification code when available
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

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
                gtag('config', '${GA_ID}', {
                  page_title: document.title,
                  page_location: window.location.href,
                  page_path: window.location.pathname + window.location.search
                });
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
