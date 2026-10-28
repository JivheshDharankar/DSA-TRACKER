import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PaginationMeta } from '../../types';
import { cx } from '../ui/cx';
import styles from './Pagination.module.css';

/**
 * DSA Tracker — shared pagination control
 * =======================================
 * The single pagination component for the app. It is presentation-only: the parent owns
 * the data and receives the requested page through `onPageChange`, so nothing here knows
 * about a query, a fetch or an API contract.
 *
 * Two presentations:
 *   `full`    (default) — the record range plus windowed page numbers, used as a page
 *             footer for a list of problems.
 *   `compact` — no range line, `Page X of Y` instead, for screens that already show their
 *             own range summary above the list.
 *
 * Behaviour preserved from the previous implementation: it renders nothing for an empty
 * result set, the record range is `start–end of total`, only the first page, the last page
 * and the pages adjacent to the current one are listed (with an ellipsis for the gaps),
 * and previous/next disable at the ends.
 *
 * Accessibility: the buttons live in a `<nav>` with an accessible name, prev/next are
 * labelled controls, the current page carries `aria-current="page"`, and the ellipsis is
 * hidden from assistive technology because it adds nothing to the page sequence.
 */

export type PaginationVariant = 'full' | 'compact';

/** One or two windowed numbers around the current page, always with first and last. */
const buildPageWindow = (page: number, totalPages: number): Array<number | 'gap'> => {
  const candidates = new Set<number>([1, totalPages, page]);
  if (page - 1 >= 1) candidates.add(page - 1);
  if (page + 1 <= totalPages) candidates.add(page + 1);

  const ordered = Array.from(candidates).sort((a, b) => a - b);

  return ordered.flatMap((value, index) => {
    const previous = ordered[index - 1];
    const needsGap = previous !== undefined && value - previous > 1;
    return needsGap ? (['gap', value] as Array<number | 'gap'>) : [value];
  });
};

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (newPage: number) => void;
  /** `full` adds the record range line. Default `full`. */
  variant?: PaginationVariant;
  /** Plural noun for the range line, e.g. `problems` or `reviews`. */
  itemLabel?: string;
  /** Renders nothing at all when everything fits on one page. */
  hideForSinglePage?: boolean;
  /** Accessible name for the `<nav>` landmark. Default `Pagination`. */
  label?: string;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  meta,
  onPageChange,
  variant = 'full',
  itemLabel = 'problems',
  hideForSinglePage = false,
  label = 'Pagination',
  className,
}) => {
  const { page, totalPages, total, limit } = meta;

  if (total === 0) return null;
  if (hideForSinglePage && totalPages <= 1) return null;

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);
  const pageWindow = buildPageWindow(page, totalPages);

  return (
    <div className={cx(styles.pagination, styles[variant], className)}>
      {variant === 'full' ? (
        <p className={styles.range}>
          Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of{' '}
          <strong>{total}</strong> {itemLabel}
        </p>
      ) : null}

      <nav className={styles.controls} aria-label={label}>
        <span className={styles.pageInfo}>
          Page {page} of {totalPages}
        </span>

        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          {pageWindow.map((entry, index) =>
            entry === 'gap' ? (
              <span key={`gap-${index}`} className={styles.ellipsis} aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                className={cx(styles.pageBtn, entry === page && styles.activePageBtn)}
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
              >
                {entry}
              </button>
            )
          )}

          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );
};
