import Link from 'next/link';
import Layout from '@/components/Layout';
import Pagination from '@/components/Pagination';
import { type Category } from '@/lib/api';

interface ListingPageProps {
  categories: Category[];
  /** Breadcrumb trail after "Home": [label, href?] pairs; the last one is the current page. */
  trail: Array<[string, string?]>;
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  pagination?: { page: number; pageCount: number; total: number; baseUrl: string };
  /** Rendered full-bleed below the header (e.g. the salon wall) instead of in the page column. */
  wall?: React.ReactNode;
  children?: React.ReactNode;
}

// The frame every shop listing shares: breadcrumb, header, the listing, pagination.
export default function ListingPage({ categories, trail, eyebrow, title, intro, pagination, wall, children }: ListingPageProps) {
  const paged = pagination && pagination.pageCount > 1;
  return (
    <Layout categories={categories}>
      <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-6 sm:pt-8">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-10">
          <Link href="/" className="hover:text-primary">Home</Link>
          {trail.map(([label, href], i) => (
            <span key={label}>
              <span aria-hidden="true" className="mx-2">/</span>
              {href && i < trail.length - 1 ? (
                <Link href={href} className="hover:text-primary">{label}</Link>
              ) : (
                <span className="text-soft">{label}</span>
              )}
            </span>
          ))}
        </nav>

        <header className="max-w-3xl flex flex-col gap-4 mb-12">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="font-display text-4xl sm:text-[56px] leading-[1.05]">{title}</h1>
          {intro && <div className="text-lg text-soft">{intro}</div>}
          {paged && (
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.pageCount} · {pagination.total} in all
            </p>
          )}
        </header>
      </div>

      {wall}

      {children && (
        <div className="mx-auto max-w-7xl px-4 sm:px-8 pb-20">
          {children}
          {pagination && (
            <Pagination currentPage={pagination.page} totalPages={pagination.pageCount} baseUrl={pagination.baseUrl} />
          )}
        </div>
      )}
    </Layout>
  );
}
