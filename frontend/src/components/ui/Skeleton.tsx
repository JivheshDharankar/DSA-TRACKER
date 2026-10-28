import React from 'react';
import { cx } from './cx';
import styles from './Skeleton.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Skeleton` and its compositions (`SkeletonText`, `SkeletonRow`, `SkeletonCard`,
 * `SkeletonTable`) — placeholders that match the dimensions of the content that will
 * replace them, so a resolved page does not jump.
 *
 * Accessibility: the bare `Skeleton` shape is `aria-hidden`. The composed variants wrap
 * their shapes in a `role="status"` container with `aria-busy="true"` and a
 * screen-reader-only label, which is what actually announces loading.
 *
 * Motion: a single slow opacity pulse built from `--duration-slow`, switched off
 * entirely under `prefers-reduced-motion`. No page-specific loading state is built here.
 */

export type SkeletonShape = 'block' | 'circle';

export interface SkeletonProps {
  shape?: SkeletonShape;
  /** CSS length or unitless pixel value. Defaults per shape. */
  width?: string | number;
  height?: string | number;
  className?: string;
}

const toLength = (value: string | number | undefined): string | undefined =>
  value === undefined ? undefined : typeof value === 'number' ? `${value}px` : value;

/** Bare shape — decorative only, always hidden from assistive technology. */
export const Skeleton: React.FC<SkeletonProps> = ({ shape = 'block', width, height, className }) => (
  <span
    className={cx(styles.shape, styles[shape], className)}
    style={{ width: toLength(width), height: toLength(height) }}
    aria-hidden="true"
  />
);

export interface SkeletonTextProps {
  /** Number of placeholder lines. Default 3. */
  lines?: number;
  /** Accessible label for the loading region. Default "Loading". */
  label?: string;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 3, label = 'Loading', className }) => (
  <div className={cx(styles.stack, className)} role="status" aria-busy="true">
    <span className="sr-only">{label}</span>
    {Array.from({ length: Math.max(1, lines) }, (_, index) => (
      <span
        key={index}
        className={cx(styles.shape, styles.textLine, index === lines - 1 && styles.textLineLast)}
        aria-hidden="true"
      />
    ))}
  </div>
);

export interface SkeletonRowProps {
  /** Number of placeholder cells. Default 5. */
  cells?: number;
  label?: string;
  className?: string;
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({ cells = 5, label = 'Loading rows', className }) => (
  <div className={cx(styles.row, className)} role="status" aria-busy="true">
    <span className="sr-only">{label}</span>
    {Array.from({ length: Math.max(1, cells) }, (_, index) => (
      <span key={index} className={cx(styles.shape, styles.cell)} aria-hidden="true" />
    ))}
  </div>
);

export interface SkeletonCardProps {
  label?: string;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ label = 'Loading card', className }) => (
  <div className={cx(styles.card, className)} role="status" aria-busy="true">
    <span className="sr-only">{label}</span>
    <span className={cx(styles.shape, styles.cardTitle)} aria-hidden="true" />
    <Skeleton shape="block" height={12} />
    <Skeleton shape="block" width="60%" height={12} />
  </div>
);

export interface SkeletonTableProps {
  /** Number of placeholder body rows. Default 5. */
  rows?: number;
  /** Number of placeholder columns. Default 5. */
  cells?: number;
  label?: string;
  className?: string;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  cells = 5,
  label = 'Loading table',
  className,
}) => (
  <div className={cx(styles.table, className)} role="status" aria-busy="true">
    <span className="sr-only">{label}</span>
    <span className={styles.tableHeader} aria-hidden="true">
      {Array.from({ length: Math.max(1, cells) }, (_, index) => (
        <span key={index} className={cx(styles.shape, styles.cell)} />
      ))}
    </span>
    {Array.from({ length: Math.max(1, rows) }, (_, index) => (
      <span key={index} className={styles.tableRow} aria-hidden="true">
        {Array.from({ length: Math.max(1, cells) }, (_, cellIndex) => (
          <span key={cellIndex} className={cx(styles.shape, styles.cell)} />
        ))}
      </span>
    ))}
  </div>
);
