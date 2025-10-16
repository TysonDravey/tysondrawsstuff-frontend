import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import Link from 'next/link';
import Image from 'next/image';
import { fetchCategoriesWithProducts } from '@/lib/api';


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
  alternates: {
    canonical: `${getBaseUrl()}/about`,
  },
};

export default async function About() {
  const categories = await fetchCategoriesWithProducts();

  return (
    <Layout categories={categories}>
      <div className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Page Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-8">
              About Tyson Draws Stuff
            </h1>

            {/* Portrait Image */}
            <div className="flex justify-center mb-12">
              <Image
                src="/images/about.jpg"
                alt="Tyson Brillon portrait"
                width={384}
                height={384}
                className="rounded-lg max-w-sm w-full h-auto"
              />
            </div>

            {/* Bio Paragraph */}
            <div className="max-w-3xl mx-auto">
              <p className="text-lg text-foreground leading-relaxed mb-8">
                Welcome to Tyson Draws Stuff! I&apos;m Kirk Brillon, the artist behind all the creative work you see here.
                What started as a passion for drawing and creating has evolved into a full collection of original
                artwork, prints, and unique merchandise. My art style blends humor, creativity, and a touch of the unexpected.
                From original character designs to pop culture reimaginings, each piece tells a story and aims to bring a smile to
                your face.
              </p>
              <p className="text-lg text-foreground leading-relaxed mb-8">
                Whether you&apos;re looking for an original piece to hang on your wall, a high-quality print for
                your collection, or some fun merchandise to show your support, you&apos;ll find something unique
                in the Tyson Draws Stuff shop.
              </p>
            </div>
          </div>

          {/* What You'll Find Section */}
          <div className="bg-card border border-border rounded-lg p-8 mb-16">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">What You&apos;ll Find Here:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ul className="space-y-3 text-foreground">
                <li className="flex items-start">
                  <span className="text-primary mr-3">•</span>
                  Original hand-drawn artwork and paintings
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3">•</span>
                  High-quality prints and posters
                </li>
              </ul>
              <ul className="space-y-3 text-foreground">
                <li className="flex items-start">
                  <span className="text-primary mr-3">•</span>
                  Unique merchandise and apparel
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3">•</span>
                  Art books and sketch collections
                </li>
              </ul>
            </div>
          </div>

          {/* Contact Section */}
          <div className="bg-card border border-border rounded-lg p-8 mb-16">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Get in Touch</h2>
            <div className="text-center text-foreground">
              <p className="mb-4">Have questions about a piece or interested in custom work?</p>
              <div className="space-y-2">
                <p className="flex items-center justify-center">
                  <span className="text-primary mr-2">📧</span>
                  kirk@tysondrawsstuff.com
                </p>
                <p className="flex items-center justify-center">
                  <span className="text-primary mr-2">🎨</span>
                  Follow for latest updates and new releases
                </p>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Ready to Explore the Collection?
            </h2>
            <p className="text-xl text-foreground/80 mb-8 max-w-2xl mx-auto leading-relaxed">
              Browse through all the available artwork, prints, and merchandise in the shop.
            </p>
            <Link
              href="/shop"
              className="inline-block bg-primary text-primary-foreground px-8 py-4 rounded-lg font-semibold hover:bg-accent transition-colors"
            >
              Browse All Art
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}