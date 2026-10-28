import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Edit2, Trash2, Eye, FileText, Lock } from 'lucide-react';
import { Problem, SectionType } from '../../types';
import { Badge } from '../ui/Badge';
import { cx } from '../ui/cx';
import { computeDueStatus } from '../reviews/SrsProgressionStepper';
import { difficultyTone, masteryTone, retentionTone, statusTone } from './badgeTones';
import { formatCalendarDate } from '../../utils/date.utils';
import { getSafeUrl } from '../../utils/url.util';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { mqDown } from '../../styles/breakpoints';
import styles from './ProblemTable.module.css';

/**
 * DSA Tracker — Tracker table (Phase 6)
 * ====================================
 * The same seven columns, the same rows and the same actions as before, restyled on the
 * Phase 0 tokens.
 *
 * Layout rule (no clipped data at any width):
 *   - >= 1280px  seven columns, exactly as the legacy table declared them;
 *   - 768–1279px the `Links` column is folded into the title cell as the very same chips
 *                (same labels, same `title`s, same `getSafeUrl` gate), so nothing is
 *                clipped and no horizontal scrolling is needed — the other six columns
 *                use a fixed layout that always fits the content column;
 *   - < 768px    the page renders cards by default; when the table view is chosen
 *                explicitly the table keeps its own bounded scroll container, so the page
 *                never overflows.
 *
 * Pills are the Phase 2 `Badge` primitive with the tracker tone maps; the labels
 * (`Easy`, `Attempted`, `Learning`, `Locked`, `In Progress`, `Stage 2 (4d)`, the due
 * labels and the formatted next-review date) are unchanged.
 */

interface ProblemTableProps {
  problems: Problem[];
  section?: SectionType;
  onEdit: (problem: Problem) => void;
  onDelete: (problem: Problem) => void;
}

export const ProblemTable: React.FC<ProblemTableProps> = ({ problems, onEdit, onDelete }) => {
  /** Below 1280px the links live in the title cell instead of their own column. */
  const foldLinks = useMediaQuery(mqDown('xl'));

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableWrapper}>
        <table className={cx(styles.table, foldLinks && styles.tableCompact)}>
          <thead>
            <tr>
              <th className={cx(styles.th, styles.sNoCol)} scope="col">
                #
              </th>
              <th className={cx(styles.th, styles.problemCol)} scope="col">
                Problem &amp; Topic
              </th>
              <th className={cx(styles.th, styles.difficultyCol)} scope="col">
                Difficulty &amp; Status
              </th>
              <th className={cx(styles.th, styles.srsColumn)} scope="col">
                Spaced Repetition
              </th>
              <th className={cx(styles.th, styles.retentionColumn)} scope="col">
                Retention &amp; Mastery
              </th>
              {!foldLinks && (
                <th className={cx(styles.th, styles.linksColumn)} scope="col">
                  Links
                </th>
              )}
              <th className={cx(styles.th, styles.actionsCol)} scope="col">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {problems.map((prob) => {
              const dueInfo = computeDueStatus(prob.nextReviewDate);
              const isLocked = prob.masteryStatus === 'LOCKED';
              const leetcodeUrl = getSafeUrl(prob.leetcodeLink);
              const collegeUrl = getSafeUrl(prob.collegeLink);

              return (
                <tr key={prob.id} className={styles.tr}>
                  {/* Column 1: S.No. */}
                  <td className={cx(styles.td, styles.sNo)}>#{prob.sNo}</td>

                  {/* Column 2: Problem & Topic */}
                  <td className={styles.td}>
                    <div className={styles.problemTitleCol}>
                      <div className={styles.titleRow}>
                        {prob.leetcodeNumber && <span className={styles.lcNumber}>#{prob.leetcodeNumber}</span>}
                        <Link to={`/problems/${prob.id}`} className={styles.titleLink} title={prob.title}>
                          {prob.title}
                        </Link>
                      </div>

                      <div className={styles.subMetaRow}>
                        <span className={styles.topicTag}>{prob.topic}</span>
                        <span className={styles.sourceText}>· {prob.source}</span>
                        {prob.notes && prob.notes.trim() && (
                          <span className={styles.notesIndicator} title={prob.notes}>
                            <FileText size={11} aria-hidden="true" />
                            <span>Notes</span>
                          </span>
                        )}
                        {foldLinks && leetcodeUrl && (
                          <a
                            href={leetcodeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.linkBadge}
                            title="Open LeetCode Problem"
                          >
                            <span>LeetCode</span>
                            <ExternalLink size={10} aria-hidden="true" />
                          </a>
                        )}
                        {foldLinks && collegeUrl && (
                          <a
                            href={collegeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.linkBadge}
                            title="Open College Problem Link"
                          >
                            <span>College</span>
                            <ExternalLink size={10} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Column 3: Difficulty & Status */}
                  <td className={styles.td}>
                    <div className={styles.badgeCol}>
                      <Badge tone={difficultyTone(prob.difficulty)} dot>
                        {prob.difficulty}
                      </Badge>
                      <Badge tone={statusTone(prob.status)}>{prob.status}</Badge>
                    </div>
                  </td>

                  {/* Column 4: Spaced Repetition */}
                  <td className={styles.td}>
                    <div className={styles.srsCol}>
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
                      <span className={styles.nextDateSub}>{formatCalendarDate(prob.nextReviewDate)}</span>
                    </div>
                  </td>

                  {/* Column 5: Retention & Mastery */}
                  <td className={styles.td}>
                    <div className={styles.retentionCol}>
                      <Badge tone={retentionTone(prob.retentionLevel)}>{prob.retentionLevel}</Badge>
                      {isLocked ? (
                        <Badge tone={masteryTone(prob.masteryStatus)}>
                          <Lock size={11} aria-hidden="true" />
                          <span>Locked</span>
                        </Badge>
                      ) : (
                        <span className={styles.unlockedSub}>In Progress</span>
                      )}
                    </div>
                  </td>

                  {/* Column 6: Links (>= 1280px only) */}
                  {!foldLinks && (
                    <td className={styles.td}>
                      <div className={styles.linksCol}>
                        {leetcodeUrl && (
                          <a
                            href={leetcodeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.linkBadge}
                            title="Open LeetCode Problem"
                          >
                            <span>LeetCode</span>
                            <ExternalLink size={10} aria-hidden="true" />
                          </a>
                        )}
                        {collegeUrl && (
                          <a
                            href={collegeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.linkBadge}
                            title="Open College Problem Link"
                          >
                            <span>College</span>
                            <ExternalLink size={10} aria-hidden="true" />
                          </a>
                        )}
                        {!leetcodeUrl && !collegeUrl && <span className={styles.emptyDash}>—</span>}
                      </div>
                    </td>
                  )}

                  {/* Column 7: Actions */}
                  <td className={cx(styles.td, styles.actionsCell)}>
                    <div className={styles.actionGroup}>
                      <Link to={`/problems/${prob.id}`} className={styles.actionBtn} title="View Details">
                        <Eye size={15} aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEdit(prob)}
                        className={styles.actionBtn}
                        title="Edit Problem"
                      >
                        <Edit2 size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(prob)}
                        className={cx(styles.actionBtn, styles.deleteActionBtn)}
                        title="Delete Problem"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
