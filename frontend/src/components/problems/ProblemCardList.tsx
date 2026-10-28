import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Edit2, Trash2, Eye, Lock } from 'lucide-react';
import { Problem, SectionType } from '../../types';
import { Badge } from '../ui/Badge';
import { cx } from '../ui/cx';
import { computeDueStatus } from '../reviews/SrsProgressionStepper';
import { difficultyTone, retentionTone, statusTone } from './badgeTones';
import { formatCalendarDate } from '../../utils/date.utils';
import { getSafeUrl } from '../../utils/url.util';
import styles from './ProblemCardList.module.css';

/**
 * DSA Tracker — Tracker card view (Phase 6)
 * ========================================
 * The mobile-first presentation: compact rows rather than a card per field group, and —
 * new in this phase — the same spaced-repetition information the table shows, so
 * switching views no longer hides the stage, the interval, the due status or the next
 * review date.
 *
 * Preserved exactly from the previous implementation: the `#S.No` chip, the `LC #N`
 * chip, the `College` / `LeetCode` link badges with their `title`s, the topic and source
 * line, the learned date, the retention/mastery semantics (a mastery chip is rendered
 * only for LOCKED, as the legacy `MasteryBadge` did by default) and the
 * `Details` / `Edit` / `Delete` actions.
 */

interface ProblemCardListProps {
  problems: Problem[];
  section: SectionType;
  onEdit: (problem: Problem) => void;
  onDelete: (problem: Problem) => void;
}

export const ProblemCardList: React.FC<ProblemCardListProps> = ({
  problems,
  section,
  onEdit,
  onDelete,
}) => {
  return (
    <div className={styles.cardList}>
      {problems.map((prob) => {
        const dueInfo = computeDueStatus(prob.nextReviewDate);
        const isLocked = prob.masteryStatus === 'LOCKED';
        const leetcodeUrl = getSafeUrl(prob.leetcodeLink);
        const collegeUrl = getSafeUrl(prob.collegeLink);

        return (
          <article key={prob.id} className={styles.card}>
            <div className={styles.headerRow}>
              <span className={styles.sNoBadge}>#{prob.sNo}</span>
              <Link to={`/problems/${prob.id}`} className={styles.title}>
                {prob.title}
              </Link>
              <div className={styles.linkGroup}>
                {collegeUrl && (
                  <a
                    href={collegeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.linkBadge}
                    title="Open College problem link"
                  >
                    <span>College</span>
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                )}
                {leetcodeUrl && (
                  <a
                    href={leetcodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.linkBadge}
                    title="Open LeetCode problem link"
                  >
                    <span>LeetCode</span>
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>

            <div className={styles.metaRow}>
              {section === 'PERSONAL' && prob.leetcodeNumber && (
                <span className={styles.lcNumber}>LC #{prob.leetcodeNumber}</span>
              )}
              <span className={styles.topicTag}>{prob.topic}</span>
              <Badge tone={difficultyTone(prob.difficulty)} dot>
                {prob.difficulty}
              </Badge>
              <Badge tone={statusTone(prob.status)}>{prob.status}</Badge>
              <Badge tone={retentionTone(prob.retentionLevel)}>
                {prob.retentionLevel === 'Locked' ? (
                  <>
                    <Lock size={11} aria-hidden="true" />
                    <span>{prob.retentionLevel}</span>
                  </>
                ) : (
                  prob.retentionLevel
                )}
              </Badge>
              {isLocked && (
                <span title="Locked Problem — Long-Term Mastered">
                  <Badge tone="warning">
                    <Lock size={11} aria-hidden="true" />
                    <span>Locked</span>
                  </Badge>
                </span>
              )}
            </div>

            <div className={styles.srsRow}>
              <span className={styles.srsStage}>
                Stage {prob.repetitionStage ?? 0} ({prob.intervalDays ?? 0}d)
              </span>
              <Badge
                tone={
                  dueInfo.state === 'OVERDUE'
                    ? 'danger'
                    : dueInfo.state === 'DUE_TODAY'
                      ? 'accent'
                      : 'success'
                }
              >
                {dueInfo.label}
              </Badge>
              <span className={styles.srsNext}>
                Next review {formatCalendarDate(prob.nextReviewDate)}
              </span>
            </div>

            <div className={styles.infoRow}>
              <span>Source: {prob.source}</span>
              <span>{new Date(prob.dateLearned).toLocaleDateString()}</span>
            </div>

            <div className={styles.actionRow}>
              <Link to={`/problems/${prob.id}`} className={styles.btn}>
                <Eye size={13} aria-hidden="true" />
                <span>Details</span>
              </Link>
              <button type="button" onClick={() => onEdit(prob)} className={styles.btn}>
                <Edit2 size={13} aria-hidden="true" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(prob)}
                className={cx(styles.btn, styles.deleteBtn)}
              >
                <Trash2 size={13} aria-hidden="true" />
                <span>Delete</span>
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
};
