import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import {
  fetchShowBySlug,
  fetchShowSlugs,
  fetchCategoriesWithProducts,
  fetchProductsByShow
} from '@/lib/api';
import { getStaticAssetUrl, getProductImages } from '@/lib/images';

interface ShowPageProps {
  params: Promise<{
    slug: string;
  }>;
}

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

export async function generateStaticParams() {
  const slugs = await fetchShowSlugs();

  return slugs.map((slug) => ({
    slug: slug,
  }));
}

export async function generateMetadata({ params }: ShowPageProps): Promise<Metadata> {
  const { slug } = await params;
  const show = await fetchShowBySlug(slug);

  if (!show) {
    return {
      title: 'Show Not Found | Tyson Draws Stuff',
      description: 'This show could not be found.',
    };
  }

  const baseUrl = getBaseUrl();
  const ogImage = show.logo ? getStaticAssetUrl(show.logo.url) : '/images/og-default.jpg';
  const fullTitle = `${show.title} | Tyson Draws Stuff`;

  // Truncate description for meta description
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
  const metaDescription = show.description
    ? stripHtml(show.description).substring(0, 150).trim() + (show.description.length > 150 ? '...' : '')
    : `Art exhibition by Tyson Brillon at ${show.location || 'gallery'}. ${show.startDate} - ${show.endDate}`;

  return {
    title: fullTitle,
    description: metaDescription,
    openGraph: {
      title: fullTitle,
      description: metaDescription,
      type: 'article',
      url: `${baseUrl}/shows/${slug}`,
      siteName: 'Tyson Draws Stuff',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: show.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: metaDescription,
      images: [ogImage],
    },
    alternates: {
      canonical: `${baseUrl}/shows/${slug}`,
    },
  };
}

export default async function ShowPage({ params }: ShowPageProps) {
  const { slug } = await params;
  const [show, categories, products] = await Promise.all([
    fetchShowBySlug(slug),
    fetchCategoriesWithProducts(),
    fetchProductsByShow(slug)
  ]);

  if (!show) {
    if (process.env.NODE_ENV === 'production') {
      return (
        <Layout categories={categories}>
          <div className="container mx-auto px-4 py-16 text-center">
            <h1 className="text-2xl font-bold mb-4 text-foreground">Show Not Available</h1>
            <p className="text-muted-foreground mb-8">This show could not be loaded at the moment.</p>
            <Link href="/shows" className="text-primary hover:text-orange-600 inline-flex items-center">
              <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Shows
            </Link>
          </div>
        </Layout>
      );
    }
    notFound();
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.getDate()}, ${end.getFullYear()}`;
    }

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getShowStatus = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'current';
    return 'past';
  };

  const showStatus = getShowStatus(show.startDate, show.endDate);

  return (
    <Layout categories={categories}>
      <div className="py-8">
        <div className="container mx-auto px-4">
          <Link
            href="/shows"
            className="text-primary hover:text-orange-600 mb-6 inline-flex items-center font-medium transition-colors"
          >
            <svg className="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Shows
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Show Info */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-lg p-6 space-y-6 sticky top-8">
                {/* Logo */}
                {show.logo && (
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                    <Image
                      src={getStaticAssetUrl(show.logo.url)}
                      alt={show.logo.alternativeText || show.title}
                      fill
                      className="object-contain"
                    />
                  </div>
                )}

                {/* Title and Status */}
                <div>
                  <div className="mb-3">
                    {showStatus === 'upcoming' && (
                      <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                        Upcoming Show
                      </span>
                    )}
                    {showStatus === 'current' && (
                      <span className="inline-block bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                        Current Show
                      </span>
                    )}
                    {showStatus === 'past' && (
                      <span className="inline-block bg-gray-100 text-gray-800 text-sm font-medium px-3 py-1 rounded-full">
                        Past Show
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-card-foreground">
                    {show.title}
                  </h1>

                  {/* Location */}
                  {show.location && (
                    <div className="flex items-start space-x-2 mb-3">
                      <svg className="w-5 h-5 text-muted-foreground mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-muted-foreground">{show.location}</span>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="flex items-start space-x-2 mb-4">
                    <svg className="w-5 h-5 text-muted-foreground mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 2h8m0 0v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6m8 0V8a1 1 0 00-1-1H8a1 1 0 00-1 1v1" />
                    </svg>
                    <span className="text-muted-foreground">
                      {formatDateRange(show.startDate, show.endDate)}
                    </span>
                  </div>

                  {/* Website */}
                  {show.website && (
                    <div className="pt-4">
                      <a
                        href={show.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full bg-primary hover:bg-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Visit Show Website
                      </a>
                    </div>
                  )}
                </div>

                {/* Description */}
                {show.description && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-card-foreground">About the Show</h3>
                    <div
                      className="text-muted-foreground leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: show.description }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Products Grid */}
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2 text-foreground">
                  Artwork at {show.title}
                </h2>
                <p className="text-muted-foreground">
                  {products.length === 0
                    ? 'No artwork currently assigned to this show.'
                    : `${products.length} piece${products.length === 1 ? '' : 's'} available at this exhibition.`
                  }
                </p>
              </div>

              {products.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map((product) => {
                    const productImages = getProductImages(product.slug, product.images || []);
                    const firstImage = productImages[0];

                    return (
                      <Link
                        key={product.id}
                        href={`/shop/${product.slug}`}
                        className="group block bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300"
                      >
                        {/* Product Image */}
                        {firstImage && (
                          <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
                            <Image
                              src={firstImage.src}
                              alt={firstImage.alt}
                              fill
                              className="object-contain group-hover:scale-105 transition-transform duration-300"
                            />

                            {/* SOLD Overlay */}
                            {product.sold === true && (
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <div className="bg-[#640006] text-white text-xl font-bold px-4 py-2 rounded-lg transform -rotate-12 shadow-2xl border-2 border-white">
                                  SOLD
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="p-4">
                          <h3 className="font-bold mb-2 text-card-foreground group-hover:text-primary transition-colors">
                            {product.title}
                          </h3>

                          {/* Pricing or SOLD */}
                          {product.sold === true ? (
                            <p className="text-lg font-bold text-[#640006]">
                              SOLD
                            </p>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground line-through">
                                Online Price: ${product.price.toFixed(2)} CAD
                              </p>
                              {product.showPrice && (
                                <p className="text-lg font-bold text-amber-600">
                                  Show Price: ${product.showPrice.toFixed(2)} CAD
                                </p>
                              )}
                            </div>
                          )}

                          {/* Category */}
                          {product.category && (
                            <div className="mt-3">
                              <span className="inline-block bg-secondary text-secondary-foreground text-xs font-medium px-2 py-1 rounded">
                                {product.category.name}
                              </span>
                            </div>
                          )}

                          <div className="mt-3 flex items-center text-primary text-sm font-medium">
                            View Details
                            <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-card border border-border rounded-lg">
                  <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">No Artwork Yet</h3>
                  <p className="text-muted-foreground">
                    Artwork for this show will be added soon. Check back later or visit other shows.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}