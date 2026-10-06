import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Play, CheckCircle2, Loader2, Sparkles, BookOpen, AlertCircle } from 'lucide-react';
import { Problem, SectionType } from '../types';
import { fetchDueReviews } from '../api/reviews.api';
import { DifficultyBadge } from '../components/problems/DifficultyBadge';
import { RetentionBadge } from '../components/problems/RetentionBadge';
import { RecallSessionModal } from '../components/reviews/RecallSessionModal';
import { getDueBadgeInfo } from '../utils/date.utils';
import { getErrorMessage } from '../utils/error.utils';
import styles from './ReviewPage.module.css';

export const ReviewPage: React.FC = () => {
  const [dueProblems, setDueProblems] = useState<Problem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedSection, setSelectedSection] = useState<SectionType | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const loadDueProblems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = selectedSection === 'ALL' ? {} : { section: selectedSection };
      const data = await fetchDueReviews(params);
      setDueProblems(data.items);
      setTotalCount(data.pagination.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch due reviews.'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedSection]);

  useEffect(() => {
    loadDueProblems();
  }, [loadDueProblems]);

  const handleStartRevision = (problem: Problem) => {
    setActiveProblem(problem);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    loadDueProblems();
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Due Revisions</h1>
          <span className={styles.countBadge}>{totalCount} Due</span>
        </div>

        <div className={styles.filterGroup}>
          <button
            onClick={() => setSelectedSection('ALL')}
            className={`${styles.filterBtn} ${selectedSection === 'ALL' ? styles.filterBtnActive : ''}`}
          >
            All Sections
          </button>
          <button
            onClick={() => setSelectedSection('COLLEGE')}
            className={`${styles.filterBtn} ${selectedSection === 'COLLEGE' ? styles.filterBtnActive : ''}`}
          >
            College DSA
          </button>
          <button
            onClick={() => setSelectedSection('PERSONAL')}
            className={`${styles.filterBtn} ${selectedSection === 'PERSONAL' ? styles.filterBtnActive : ''}`}
          >
            Personal DSA
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px',
            gap: '16px',
          }}
        >
          <Loader2 size={36} className="animate-spin" color="var(--accent-cyan)" />
          <span style={{ color: 'var(--text-muted)' }}>Loading due revision queue...</span>
        </div>
      ) : dueProblems.length === 0 ? (
        <div className={styles.emptyBox}>
          <div className={styles.emptyIcon}>
            <CheckCircle2 size={32} />
          </div>
          <h3 style={{ color: 'var(--text-main)', fontSize: '1.3rem', fontWeight: 700 }}>
            All Caught Up!
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '0.9rem' }}>
            Zero problems are currently due for spaced repetition. Solve new problems or relax until
            your next scheduled interval!
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <Link
              to="/personal-dsa"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              <Sparkles size={15} color="var(--accent-cyan)" />
              <span>Personal DSA</span>
            </Link>
            <Link
              to="/college-dsa"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              <BookOpen size={15} color="var(--accent-cyan)" />
              <span>College DSA</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.queueList}>
          {dueProblems.map((prob) => {
            const dueInfo = getDueBadgeInfo(prob.nextReviewDate);
            return (
              <div key={prob.id} className={styles.dueCard}>
                <div className={styles.cardLeft}>
                  <div className={styles.cardTop}>
                    <span className={styles.sNoBadge}>#{prob.sNo}</span>
                    <span className={styles.sectionBadge}>{prob.section}</span>
                    <Link to={`/problems/${prob.id}`} className={styles.problemTitle}>
                      {prob.title}
                    </Link>
                  </div>

                  <div className={styles.cardMeta}>
                    <DifficultyBadge difficulty={prob.difficulty} />
                    <RetentionBadge retention={prob.retentionLevel} />
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
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        color: 'var(--text-dim)',
                      }}
                    >
                      Stage {prob.repetitionStage} ({prob.intervalDays}d)
                    </span>
                    <span
                      className={`${styles.dueStatusBadge} ${
                        dueInfo.isOverdue ? styles.dueOverdue : styles.dueToday
                      }`}
                    >
                      {dueInfo.label}
                    </span>
                  </div>
                </div>

                <button onClick={() => handleStartRevision(prob)} className={styles.startBtn}>
                  <Play size={15} />
                  <span>Start Revision</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <RecallSessionModal
        isOpen={isModalOpen}
        problem={activeProblem}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};
