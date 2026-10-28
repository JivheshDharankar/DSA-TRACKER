import React from 'react';
import { PatternMasteryLevel } from '../../types';
import { Badge, BadgeTone } from '../ui/Badge';
import { cx } from '../ui/cx';
import styles from './PatternMasteryBadge.module.css';

/**
 * DSA Tracker — pattern mastery chip
 * ==================================
 * The label, the score and the `sm`/`md`/`lg` sizes are exactly the same as before, but
 * the chip is now the shared `Badge` primitive in `pill` shape with a status dot, and the
 * four levels map onto semantic tones instead of hardcoded hex values:
 *
 *   Learning    → neutral   (slate)
 *   Familiar    → info      (sky)
 *   Independent → accent    (indigo)
 *   Strong      → success   (emerald)
 *
 * Sizes are expressed by the wrapping element's class (`.sm` / `.md` / `.lg`), which the
 * module uses to adjust the badge's own geometry — the primitive keeps owning colour,
 * radius, dot and typography.
 */

const LEVEL_TONE: Record<PatternMasteryLevel, BadgeTone> = {
  Learning: 'neutral',
  Familiar: 'info',
  Independent: 'accent',
  Strong: 'success',
};

export interface PatternMasteryBadgeProps {
  level: PatternMasteryLevel;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
}

export const PatternMasteryBadge: React.FC<PatternMasteryBadgeProps> = ({
  level,
  score,
  size = 'md',
  showScore = true,
}) => (
  <span className={cx(styles.shell, styles[size])}>
    <Badge tone={LEVEL_TONE[level] ?? 'neutral'} shape="pill" dot>
      <span className={styles.label}>{level}</span>
      {showScore && score !== undefined ? (
        <>
          {' '}
          <span className={styles.score}>({score}%)</span>
        </>
      ) : null}
    </Badge>
  </span>
);
