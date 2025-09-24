import Link from 'next/link';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

export default function Pagination({ currentPage, totalPages, baseUrl }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const showPages = 5; // Show 5 page numbers at most

    let startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + showPages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage < showPages - 1) {
      startPage = Math.max(1, endPage - showPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex justify-center items-center space-x-2 mt-12">
      {/* Previous Button */}
      {currentPage > 1 && (
        <Link
          href={currentPage === 2 ? baseUrl : `${baseUrl}/page/${currentPage - 1}`}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary border border-border rounded-md hover:bg-muted transition-colors"
        >
          ← Previous
        </Link>
      )}

      {/* First page if not in range */}
      {pages[0] > 1 && (
        <>
          <Link
            href={baseUrl}
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary border border-border rounded-md hover:bg-muted transition-colors"
          >
            1
          </Link>
          {pages[0] > 2 && <span className="px-2 text-muted-foreground">...</span>}
        </>
      )}

      {/* Page Numbers */}
      {pages.map((page) => (
        <Link
          key={page}
          href={page === 1 ? baseUrl : `${baseUrl}/page/${page}`}
          className={`px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
            currentPage === page
              ? 'bg-primary text-primary-foreground border-primary'
              : 'text-muted-foreground hover:text-primary border-border hover:bg-muted'
          }`}
        >
          {page}
        </Link>
      ))}

      {/* Last page if not in range */}
      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && <span className="px-2 text-muted-foreground">...</span>}
          <Link
            href={`${baseUrl}/page/${totalPages}`}
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary border border-border rounded-md hover:bg-muted transition-colors"
          >
            {totalPages}
          </Link>
        </>
      )}

      {/* Next Button */}
      {currentPage < totalPages && (
        <Link
          href={`${baseUrl}/page/${currentPage + 1}`}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary border border-border rounded-md hover:bg-muted transition-colors"
        >
          Next →
        </Link>
      )}
    </div>
  );
}