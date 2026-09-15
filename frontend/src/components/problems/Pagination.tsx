import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PaginationMeta } from '../../types';
import styles from './Pagination.module.css';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (newPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ meta, onPageChange }) => {
  const { page, totalPages, total, limit } = meta;

  if (total === 0) return null;

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className={styles.paginationContainer}>
      <div className={styles.metaInfo}>
        Showing <strong style={{ color: 'var(--text-main)' }}>{startRecord}</strong> to{' '}
        <strong style={{ color: 'var(--text-main)' }}>{endRecord}</strong> of{' '}
        <strong style={{ color: 'var(--text-main)' }}>{total}</strong> problems
      </div>

      <div className={styles.controls}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={styles.pageBtn}
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .map((p, idx, arr) => {
            const prev = arr[idx - 1];
            const showEllipsis = prev && p - prev > 1;

            return (
              <React.Fragment key={p}>
                {showEllipsis && (
                  <span style={{ padding: '0 4px', color: 'var(--text-dim)' }}>...</span>
                )}
                <button
                  onClick={() => onPageChange(p)}
                  className={`${styles.pageBtn} ${p === page ? styles.activePageBtn : ''}`}
                >
                  {p}
                </button>
              </React.Fragment>
            );
          })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={styles.pageBtn}
          title="Next Page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
