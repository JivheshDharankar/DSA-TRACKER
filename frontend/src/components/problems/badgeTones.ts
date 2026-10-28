import type { BadgeTone } from '../ui/Badge';
import type { DifficultyType, MasteryStatus, RetentionType, StatusType } from '../../types';

/**
 * DSA Tracker — Tracker pill tones (Phase 6)
 * =========================================
 * The tracker renders four pill families (difficulty, status, retention, mastery) on top
 * of the Phase 2 `Badge` primitive. Their tone is decided here, once, so the table and
 * the card list can never disagree about what a `Hard` or a `Strong` pill looks like.
 *
 * The *labels* are the caller's job and stay exactly as the legacy components rendered
 * them — this module only chooses a `BadgeTone`.
 *
 * Deliberately tracker-scoped: `DifficultyBadge` / `StatusBadge` / `RetentionBadge` /
 * `MasteryBadge` are shared with Problem Detail, Review, Review History, Patterns,
 * Pattern Detail, Locked Problems and the recall modal, and are untouched in this phase.
 * Cross-application badge consistency is a later phase.
 */

export const difficultyTone = (difficulty: DifficultyType): BadgeTone => {
  switch (difficulty) {
    case 'Easy':
      return 'success';
    case 'Medium':
      return 'warning';
    case 'Hard':
      return 'danger';
    default:
      return 'neutral';
  }
};

export const statusTone = (status: StatusType): BadgeTone => {
  switch (status) {
    case 'Not Started':
      return 'neutral';
    case 'Attempted':
      return 'warning';
    case 'Solved':
      return 'success';
    default:
      return 'neutral';
  }
};

export const retentionTone = (retention: RetentionType): BadgeTone => {
  switch (retention) {
    case 'Learning':
      return 'neutral';
    case 'Familiar':
      return 'info';
    case 'Independent':
      return 'accent';
    case 'Strong':
      return 'success';
    case 'Locked':
      return 'warning';
    default:
      return 'neutral';
  }
};

export const masteryTone = (mastery: MasteryStatus): BadgeTone =>
  mastery === 'LOCKED' ? 'warning' : 'neutral';
