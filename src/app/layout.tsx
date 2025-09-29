import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Tyson Draws Stuff | Original Art, Prints, and Books",
  description: "Explore original art, posters, merch, and books by Tyson Brillon. Unique artwork and prints available for purchase.",
  metadataBase: new URL("https://tysondrawsstuff.com"),
  openGraph: {
    title: "Tyson Draws Stuff | Original Art, Prints, and Books",
    description: "Explore original art, posters, merch, and books by Tyson Brillon. Unique artwork and prints available for purchase.",
    url: "https://tysondrawsstuff.com",
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
  return (
    <html lang="en">
      <body
        className={`${nunito.variable} ${nunitoSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
// Trigger deployment - Tue, Sep 23, 2025  8:38:19 PM
