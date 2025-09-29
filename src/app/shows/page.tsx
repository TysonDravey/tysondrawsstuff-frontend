import Link from 'next/link';
import Layout from '@/components/Layout';
import { fetchShows, fetchCategoriesWithProducts } from '@/lib/api';
import { getStaticAssetUrl } from '@/lib/images';

export default async function ShowsPage() {
  const [shows, categories] = await Promise.all([
    fetchShows(),
    fetchCategoriesWithProducts()
  ]);

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

  const isCurrentShow = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    return now >= start && now <= end;
  };

  const currentShows = shows.filter(show => isCurrentShow(show.startDate, show.endDate));
  const pastShows = shows.filter(show => !isCurrentShow(show.startDate, show.endDate));

  return (
    <Layout categories={categories}>
      <div className="py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
              Shows & Exhibitions
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Discover Tyson's artwork at galleries, art shows, and exhibitions. Special show pricing and exclusive pieces available at each event.
            </p>
          </div>

          {/* Current Shows */}
          {currentShows.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-6 text-foreground">Current Shows</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentShows.map((show) => (
                  <Link
                    key={show.id}
                    href={`/shows/${show.slug}`}
                    className="group block bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300"
                  >
                    {/* Show Logo */}
                    {show.logo && (
                      <div className="aspect-video bg-gray-100 overflow-hidden">
                        <img
                          src={getStaticAssetUrl(show.logo.url)}
                          alt={show.logo.alternativeText || show.title}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}

                    <div className="p-6">
                      {/* Current Badge */}
                      <div className="mb-3">
                        <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                          Current Show
                        </span>
                      </div>

                      <h3 className="text-xl font-bold mb-2 text-card-foreground group-hover:text-primary transition-colors">
                        {show.title}
                      </h3>

                      {show.location && (
                        <p className="text-muted-foreground mb-2 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {show.location}
                        </p>
                      )}

                      <p className="text-sm text-muted-foreground mb-3">
                        {formatDateRange(show.startDate, show.endDate)}
                      </p>

                      {show.description && (
                        <div
                          className="text-sm text-muted-foreground line-clamp-3"
                          dangerouslySetInnerHTML={{
                            __html: show.description.length > 150
                              ? show.description.substring(0, 150) + '...'
                              : show.description
                          }}
                        />
                      )}

                      <div className="mt-4 flex items-center text-primary text-sm font-medium">
                        View Details
                        <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Past Shows */}
          {pastShows.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-6 text-foreground">Past Shows</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastShows.map((show) => (
                  <Link
                    key={show.id}
                    href={`/shows/${show.slug}`}
                    className="group block bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 opacity-80 hover:opacity-100"
                  >
                    {/* Show Logo */}
                    {show.logo && (
                      <div className="aspect-video bg-gray-100 overflow-hidden">
                        <img
                          src={getStaticAssetUrl(show.logo.url)}
                          alt={show.logo.alternativeText || show.title}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}

                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2 text-card-foreground group-hover:text-primary transition-colors">
                        {show.title}
                      </h3>

                      {show.location && (
                        <p className="text-muted-foreground mb-2 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {show.location}
                        </p>
                      )}

                      <p className="text-sm text-muted-foreground mb-3">
                        {formatDateRange(show.startDate, show.endDate)}
                      </p>

                      {show.description && (
                        <div
                          className="text-sm text-muted-foreground line-clamp-3"
                          dangerouslySetInnerHTML={{
                            __html: show.description.length > 150
                              ? show.description.substring(0, 150) + '...'
                              : show.description
                          }}
                        />
                      )}

                      <div className="mt-4 flex items-center text-primary text-sm font-medium">
                        View Details
                        <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {shows.length === 0 && (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 2h8m0 0v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6m8 0V8a1 1 0 00-1-1H8a1 1 0 00-1 1v1" />
              </svg>
              <h3 className="text-xl font-semibold mb-2 text-foreground">No Shows Available</h3>
              <p className="text-muted-foreground">Check back soon for upcoming exhibitions and art shows.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}