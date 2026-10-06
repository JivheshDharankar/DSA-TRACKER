import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Edit2, Trash2, Eye } from 'lucide-react';
import { Problem, SectionType } from '../../types';
import { DifficultyBadge } from './DifficultyBadge';
import { RetentionBadge } from './RetentionBadge';
import { StatusBadge } from './StatusBadge';
import { MasteryBadge } from './MasteryBadge';
import { getSafeUrl } from '../../utils/url.util';
import styles from './ProblemCardList.module.css';

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
      {problems.map((prob) => (
        <div key={prob.id} className={styles.card}>
          <div className={styles.headerRow}>
            <span className={styles.sNoBadge}>#{prob.sNo}</span>
            <Link to={`/problems/${prob.id}`} className={styles.title}>
              {prob.title}
            </Link>
            <div className={styles.linkGroup}>
              {getSafeUrl(prob.collegeLink) && (
                <a
                  href={getSafeUrl(prob.collegeLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.linkBadge} ${styles.collegeLink}`}
                  title="Open College problem link"
                >
                  <span>College</span>
                  <ExternalLink size={11} />
                </a>
              )}
              {getSafeUrl(prob.leetcodeLink) && (
                <a
                  href={getSafeUrl(prob.leetcodeLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.linkBadge} ${styles.leetcodeLink}`}
                  title="Open LeetCode problem link"
                >
                  <span>LeetCode</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          <div className={styles.metaRow}>
            {section === 'PERSONAL' && prob.leetcodeNumber && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--accent-cyan)',
                  padding: '2px 6px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                LC #{prob.leetcodeNumber}
              </span>
            )}
            <span
              style={{
                fontSize: '0.75rem',
                background: 'var(--bg-surface-elevated)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
              }}
            >
              {prob.topic}
            </span>
            <DifficultyBadge difficulty={prob.difficulty} />
            <StatusBadge status={prob.status} />
            <RetentionBadge retention={prob.retentionLevel} />
            <MasteryBadge status={prob.masteryStatus} />
          </div>

          <div className={styles.infoRow}>
            <span>Source: {prob.source}</span>
            <span>{new Date(prob.dateLearned).toLocaleDateString()}</span>
          </div>

          <div className={styles.actionRow}>
            <Link to={`/problems/${prob.id}`} className={styles.btn}>
              <Eye size={13} />
              <span>Details</span>
            </Link>
            <button onClick={() => onEdit(prob)} className={styles.btn}>
              <Edit2 size={13} />
              <span>Edit</span>
            </button>
            <button
              onClick={() => onDelete(prob)}
              className={`${styles.btn} ${styles.deleteBtn}`}
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
