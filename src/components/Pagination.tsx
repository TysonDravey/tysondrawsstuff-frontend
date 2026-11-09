import Link from 'next/link';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

// Up to five page numbers around the current one, plus first/last with "…" gaps.
function pageWindow(current: number, total: number) {
  let start = Math.max(1, current - 2);
  const end = Math.min(total, start + 4);
  start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

const pill = 'min-w-11 h-11 px-3 grid place-items-center rounded-full text-sm font-semibold transition-colors';
const idle = `${pill} border border-border text-soft hover:border-primary hover:text-primary`;

export default function Pagination({ currentPage, totalPages, baseUrl }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Page 1 is the listing itself; the rest live at /page/N/ (the site uses trailing slashes).
  const href = (page: number) => (page === 1 ? `${baseUrl}/` : `${baseUrl}/page/${page}/`);
  const pages = pageWindow(currentPage, totalPages);
  const first = pages[0];
  const last = pages[pages.length - 1];

  return (
    <nav aria-label="Pages" className="mt-14 flex flex-wrap justify-center items-center gap-2">
      {currentPage > 1 && (
        <Link href={href(currentPage - 1)} rel="prev" className={`${idle} px-5`}>
          ← <span className="ml-1.5 hidden sm:inline">Previous</span>
        </Link>
      )}

      {first > 1 && (
        <>
          <Link href={href(1)} className={idle}>1</Link>
          {first > 2 && <span aria-hidden="true" className="px-1 text-muted-foreground">…</span>}
        </>
      )}

      {pages.map(page =>
        page === currentPage ? (
          <span key={page} aria-current="page" className={`${pill} bg-primary text-primary-foreground`}>
            {page}
          </span>
        ) : (
          <Link key={page} href={href(page)} className={idle}>
            {page}
          </Link>
        ),
      )}

      {last < totalPages && (
        <>
          {last < totalPages - 1 && <span aria-hidden="true" className="px-1 text-muted-foreground">…</span>}
          <Link href={href(totalPages)} className={idle}>{totalPages}</Link>
        </>
      )}

      {currentPage < totalPages && (
        <Link href={href(currentPage + 1)} rel="next" className={`${idle} px-5`}>
          <span className="mr-1.5 hidden sm:inline">Next</span> →
        </Link>
      )}
    </nav>
  );
}
