import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Edit2, Trash2, Eye, FileText, Lock } from 'lucide-react';
import { Problem, SectionType } from '../../types';
import { DifficultyBadge } from './DifficultyBadge';
import { RetentionBadge } from './RetentionBadge';
import { StatusBadge } from './StatusBadge';
import { computeDueStatus } from '../reviews/SrsProgressionStepper';
import { formatCalendarDate } from '../../utils/date.utils';
import styles from './ProblemTable.module.css';

interface ProblemTableProps {
  problems: Problem[];
  section?: SectionType;
  onEdit: (problem: Problem) => void;
  onDelete: (problem: Problem) => void;
}

export const ProblemTable: React.FC<ProblemTableProps> = ({
  problems,
  onEdit,
  onDelete,
}) => {
  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} style={{ width: '56px' }}>#</th>
              <th className={styles.th}>Problem & Topic</th>
              <th className={styles.th} style={{ width: '130px' }}>Difficulty & Status</th>
              <th className={styles.th} style={{ width: '160px' }}>Spaced Repetition</th>
              <th className={styles.th} style={{ width: '130px' }}>Retention & Mastery</th>
              <th className={styles.th} style={{ width: '130px' }}>Links</th>
              <th className={styles.th} style={{ width: '90px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((prob) => {
              const dueInfo = computeDueStatus(prob.nextReviewDate);
              const isLocked = prob.masteryStatus === 'LOCKED';

              return (
                <tr key={prob.id} className={styles.tr}>
                  {/* Column 1: S.No. */}
                  <td className={`${styles.td} ${styles.sNo}`}>
                    #{prob.sNo}
                  </td>

                  {/* Column 2: Problem & Topic */}
                  <td className={styles.td}>
                    <div className={styles.problemTitleCol}>
                      <div className={styles.titleRow}>
                        {prob.leetcodeNumber && (
                          <span className={styles.lcNumber}>#{prob.leetcodeNumber}</span>
                        )}
                        <Link
                          to={`/problems/${prob.id}`}
                          className={styles.titleLink}
                          title={prob.title}
                        >
                          {prob.title}
                        </Link>
                      </div>

                      <div className={styles.subMetaRow}>
                        <span className={styles.topicTag}>{prob.topic}</span>
                        <span className={styles.sourceText}>· {prob.source}</span>
                        {prob.notes && prob.notes.trim() && (
                          <span className={styles.notesIndicator} title={prob.notes}>
                            <FileText size={11} color="var(--accent-cyan)" />
                            <span>Notes</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Column 3: Difficulty & Status */}
                  <td className={styles.td}>
                    <div className={styles.badgeCol}>
                      <DifficultyBadge difficulty={prob.difficulty} />
                      <StatusBadge status={prob.status} />
                    </div>
                  </td>

                  {/* Column 4: Spaced Repetition */}
                  <td className={styles.td}>
                    <div className={styles.srsCol}>
                      <span className={styles.srsStage}>
                        Stage {prob.repetitionStage ?? 0} ({prob.intervalDays ?? 0}d)
                      </span>
                      <span
                        className={`${styles.duePill} ${
                          dueInfo.state === 'OVERDUE'
                            ? styles.dueOverdue
                            : dueInfo.state === 'DUE_TODAY'
                            ? styles.dueToday
                            : styles.dueUpcoming
                        }`}
                      >
                        {dueInfo.label}
                      </span>
                      <span className={styles.nextDateSub}>
                        {formatCalendarDate(prob.nextReviewDate)}
                      </span>
                    </div>
                  </td>

                  {/* Column 5: Retention & Mastery */}
                  <td className={styles.td}>
                    <div className={styles.retentionCol}>
                      <RetentionBadge retention={prob.retentionLevel} />
                      {isLocked ? (
                        <div className={styles.lockedSeal}>
                          <Lock size={11} />
                          <span>Locked</span>
                        </div>
                      ) : (
                        <span className={styles.unlockedSub}>In Progress</span>
                      )}
                    </div>
                  </td>

                  {/* Column 6: Links */}
                  <td className={styles.td}>
                    <div className={styles.linksCol}>
                      {prob.leetcodeLink && (
                        <a
                          href={prob.leetcodeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${styles.linkBadge} ${styles.leetcodeLink}`}
                          title="Open LeetCode Problem"
                        >
                          <span>LeetCode</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                      {prob.collegeLink && (
                        <a
                          href={prob.collegeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${styles.linkBadge} ${styles.collegeLink}`}
                          title="Open College Problem Link"
                        >
                          <span>College</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                      {!prob.leetcodeLink && !prob.collegeLink && (
                        <span className={styles.emptyDash}>—</span>
                      )}
                    </div>
                  </td>

                  {/* Column 7: Actions */}
                  <td className={styles.td} style={{ textAlign: 'right' }}>
                    <div className={styles.actionGroup}>
                      <Link
                        to={`/problems/${prob.id}`}
                        className={styles.actionBtn}
                        title="View Details"
                      >
                        <Eye size={15} />
                      </Link>
                      <button
                        onClick={() => onEdit(prob)}
                        className={styles.actionBtn}
                        title="Edit Problem"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => onDelete(prob)}
                        className={`${styles.actionBtn} ${styles.deleteActionBtn}`}
                        title="Delete Problem"
                      >
                        <Trash2 size={15} />
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
