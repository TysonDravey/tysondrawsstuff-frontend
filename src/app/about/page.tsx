import Layout from '@/components/Layout';
import Link from 'next/link';
import Image from 'next/image';
import { fetchCategoriesWithProducts, type Category } from '@/lib/api';

export default async function About() {
  const categories = await fetchCategoriesWithProducts();

  return (
    <Layout categories={categories}>
      <div className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Page Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
              About Tyson Draws Stuff
            </h1>
            <p className="text-xl text-muted-foreground">
              The art and story behind the work
            </p>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Bio Section */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground">About the Artist</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Welcome to Tyson Draws Stuff! I&apos;m Kirk Brillon, the artist behind all the creative work you see here.
                  What started as a passion for drawing and creating has evolved into a full collection of original
                  artwork, prints, and unique merchandise.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  My art style blends humor, creativity, and a touch of the unexpected. From original character
                  designs to pop culture reimaginings, each piece tells a story and aims to bring a smile to
                  your face.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Whether you&apos;re looking for an original piece to hang on your wall, a high-quality print for
                  your collection, or some fun merchandise to show your support, you&apos;ll find something unique
                  in the Tyson Draws Stuff shop.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-foreground">What You&apos;ll Find Here:</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    Original hand-drawn artwork and paintings
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    High-quality prints and posters
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    Unique merchandise and apparel
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    Art books and sketch collections
                  </li>
                </ul>
              </div>
            </div>

            {/* Artist Photo Placeholder */}
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-8 text-center">
                <div className="w-48 h-48 mx-auto mb-6 relative">
                  <Image
                    src={`${process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1339'}/uploads/TysonPuppet_head_07_small_01.png`}
                    alt="Kirk Brillon - Artist"
                    fill
                    className="object-cover rounded-full"
                  />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-2">Kirk Brillon</h3>
                <p className="text-muted-foreground">Artist & Creator</p>
              </div>

              {/* Contact Info */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Get in Touch</h3>
                <div className="space-y-3 text-muted-foreground">
                  <p>Have questions about a piece or interested in custom work?</p>
                  <div className="space-y-2">
                    <p className="flex items-center">
                      <span className="text-primary mr-2">📧</span>
                      kirk@tysondrawsstuff.com
                    </p>
                    <p className="flex items-center">
                      <span className="text-primary mr-2">🎨</span>
                      Follow for latest updates and new releases
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-16 pt-16 border-t border-border">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Ready to Explore the Collection?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Browse through all the available artwork, prints, and merchandise in the shop.
            </p>
            <div className="flex justify-center">
              <Link
                href="/shop"
                className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
              >
                Browse All Art
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}