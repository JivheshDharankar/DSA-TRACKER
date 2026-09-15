import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Lock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { fetchMasteryOverview } from '../api/mastery.api';
import { ProblemMasteryOverviewItem } from '../types';
import { DifficultyBadge } from '../components/problems/DifficultyBadge';
import { formatCalendarDate } from '../utils/date.utils';
import styles from './LockedProblemsPage.module.css';

export const LockedProblemsPage: React.FC = () => {
  const [items, setItems] = useState<ProblemMasteryOverviewItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'LOCKED' | 'IN_PROGRESS'>('ALL');

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Bulk 2-query fetch (Zero N+1)
      const data = await fetchMasteryOverview();
      setItems(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load locked problems.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const lockedCount = items.filter((i) => i.problem.masteryStatus === 'LOCKED').length;
  const inProgressCount = items.filter((i) => i.problem.masteryStatus !== 'LOCKED').length;

  const filteredItems = items.filter((item) => {
    if (filterMode === 'LOCKED') return item.problem.masteryStatus === 'LOCKED';
    if (filterMode === 'IN_PROGRESS') return item.problem.masteryStatus !== 'LOCKED';
    return true;
  });

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconCircle}>
            <Lock size={22} color="#fbbf24" />
          </div>
          <div>
            <h1 className={styles.title}>Locked Problems</h1>
            <p className={styles.subtitle}>
              Proof-of-learning mastery vault. Problems that pass all 4 rigorous qualification gates
              are locked into long-term retention.
            </p>
          </div>
        </div>

        <div className={styles.statsPillGroup}>
          <div className={styles.statsPillLocked}>
            <Lock size={14} color="#fbbf24" />
            <span>{lockedCount} Locked</span>
          </div>
          <div className={styles.statsPillInProgress}>
            <Sparkles size={14} color="var(--accent-cyan)" />
            <span>{inProgressCount} In Progress</span>
          </div>
        </div>
      </header>

      {/* Educational 4-Gate Explanation Banner */}
      <div className={styles.gatesExplainerCard}>
        <div className={styles.explainerHeader}>
          <ShieldCheck size={18} color="#fbbf24" />
          <h2 className={styles.explainerTitle}>The 4 Authoritative Locked Mastery Gates</h2>
        </div>
        <p className={styles.explainerDesc}>
          To protect against false confidence, a problem is locked only when all 4 conditions are met.
          Any subsequent review failure (HINT or FORGOT) will automatically unlock the problem for recovery.
        </p>
        <div className={styles.gatesGrid}>
          <div className={styles.gateGuideItem}>
            <span className={styles.gateGuideLetter}>Gate A</span>
            <span className={styles.gateGuideName}>Solved Status</span>
            <span className={styles.gateGuideText}>
              Problem status must be marked as <strong>Solved</strong>.
            </span>
          </div>

          <div className={styles.gateGuideItem}>
            <span className={styles.gateGuideLetter}>Gate B</span>
            <span className={styles.gateGuideName}>SRS Evidence</span>
            <span className={styles.gateGuideText}>
              At least <strong>3 successful reviews</strong> (EASY or STRUGGLED) AND reached <strong>Stage 3+ (Day 7 interval)</strong>.
            </span>
          </div>

          <div className={styles.gateGuideItem}>
            <span className={styles.gateGuideLetter}>Gate C</span>
            <span className={styles.gateGuideName}>Cold Recall</span>
            <span className={styles.gateGuideText}>
              At least <strong>2 successful cold solves</strong> without checking notes or hints.
            </span>
          </div>

          <div className={styles.gateGuideItem}>
            <span className={styles.gateGuideLetter}>Gate D</span>
            <span className={styles.gateGuideName}>Recent Consistency</span>
            <span className={styles.gateGuideText}>
              Most recent learning review outcome must be <strong>EASY or STRUGGLED</strong> (no lingering failures).
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterRow}>
        <div className={styles.filterBtns}>
          <button
            onClick={() => setFilterMode('ALL')}
            className={`${styles.filterBtn} ${filterMode === 'ALL' ? styles.filterBtnActive : ''}`}
          >
            All Problems ({items.length})
          </button>
          <button
            onClick={() => setFilterMode('LOCKED')}
            className={`${styles.filterBtn} ${filterMode === 'LOCKED' ? styles.filterBtnActive : ''}`}
          >
            Locked Mastery ({lockedCount})
          </button>
          <button
            onClick={() => setFilterMode('IN_PROGRESS')}
            className={`${styles.filterBtn} ${filterMode === 'IN_PROGRESS' ? styles.filterBtnActive : ''}`}
          >
            In Progress ({inProgressCount})
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorCard}>
          <AlertCircle size={20} color="#f87171" />
          <span>{error}</span>
          <button onClick={loadOverview} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loadingContainer}>
          <Loader2 size={36} className="animate-spin" color="var(--accent-cyan)" />
          <span style={{ color: 'var(--text-muted)' }}>Evaluating mastery gates across your library...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.emptyCard}>
          <Lock size={36} color="var(--text-dim)" />
          <h3 className={styles.emptyTitle}>
            {filterMode === 'LOCKED' ? 'No Problems Locked Yet' : 'No Problems Found'}
          </h3>
          <p className={styles.emptyText}>
            {filterMode === 'LOCKED'
              ? 'Complete SRS reviews and cold solves on your solved problems to unlock their proof-of-learning seal.'
              : 'Add problems to your trackers to begin your qualification journey.'}
          </p>
          <Link to="/review" className={styles.primaryCta}>
            <span>Go to Review Queue</span>
          </Link>
        </div>
      ) : (
        <div className={styles.problemsList}>
          {filteredItems.map(({ problem, gates }) => {
            const isLocked = problem.masteryStatus === 'LOCKED';

            return (
              <div
                key={problem.id}
                className={`${styles.problemCard} ${isLocked ? styles.cardLocked : ''}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.headerLeft}>
                    <span className={styles.sNoBadge}>#{problem.sNo}</span>
                    <span className={styles.sectionBadge}>{problem.section}</span>
                    <Link to={`/problems/${problem.id}`} className={styles.problemTitle}>
                      {problem.title}
                    </Link>
                    <DifficultyBadge difficulty={problem.difficulty} />
                  </div>

                  <div className={styles.headerRight}>
                    {isLocked ? (
                      <div className={styles.lockedBadge}>
                        <Lock size={13} />
                        <span>LOCKED (v{problem.lockVersion})</span>
                      </div>
                    ) : (
                      <div className={styles.unlockedBadge}>
                        <span>In Progress</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gates Status Row */}
                <div className={styles.gatesContainer}>
                  {/* Gate A */}
                  <div
                    className={`${styles.gateBadge} ${
                      gates.solved.passed ? styles.gatePassed : styles.gateFailed
                    }`}
                  >
                    {gates.solved.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    <div className={styles.gateTextCol}>
                      <span className={styles.gateName}>Gate A · Solved</span>
                      <span className={styles.gateDetail}>
                        {gates.solved.passed ? 'Status: Solved ✓' : `Status: ${gates.solved.status}`}
                      </span>
                    </div>
                  </div>

                  {/* Gate B */}
                  <div
                    className={`${styles.gateBadge} ${
                      gates.srsEvidence.passed ? styles.gatePassed : styles.gateFailed
                    }`}
                  >
                    {gates.srsEvidence.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    <div className={styles.gateTextCol}>
                      <span className={styles.gateName}>Gate B · SRS Evidence</span>
                      <span className={styles.gateDetail}>
                        {gates.srsEvidence.successfulReviewsCount}/3 reviews · Stage {gates.srsEvidence.maxStageReached}
                      </span>
                    </div>
                  </div>

                  {/* Gate C */}
                  <div
                    className={`${styles.gateBadge} ${
                      gates.coldRecall.passed ? styles.gatePassed : styles.gateFailed
                    }`}
                  >
                    {gates.coldRecall.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    <div className={styles.gateTextCol}>
                      <span className={styles.gateName}>Gate C · Cold Solves</span>
                      <span className={styles.gateDetail}>
                        {gates.coldRecall.qualifyingColdSolvesCount}/2 cold solves
                      </span>
                    </div>
                  </div>

                  {/* Gate D */}
                  <div
                    className={`${styles.gateBadge} ${
                      gates.recentSuccess.passed ? styles.gatePassed : styles.gateFailed
                    }`}
                  >
                    {gates.recentSuccess.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    <div className={styles.gateTextCol}>
                      <span className={styles.gateName}>Gate D · Last Review</span>
                      <span className={styles.gateDetail}>
                        {gates.recentSuccess.latestOutcome
                          ? `Last: ${gates.recentSuccess.latestOutcome}`
                          : 'No reviews yet'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Explanation */}
                <div className={styles.cardFooter}>
                  {isLocked ? (
                    <span className={styles.footerNoteLocked}>
                      ✓ Locked {problem.lockedAt ? `on ${formatCalendarDate(problem.lockedAt)}` : ''}. Memory sealed with verified recall proof.
                    </span>
                  ) : (
                    <span className={styles.footerNoteUnlocked}>
                      {!gates.solved.passed
                        ? 'Needs status changed to Solved.'
                        : !gates.srsEvidence.passed
                        ? `Needs ${Math.max(0, 3 - gates.srsEvidence.successfulReviewsCount)} more successful reviews (reaching Stage 3+).`
                        : !gates.coldRecall.passed
                        ? `Needs ${Math.max(0, 2 - gates.coldRecall.qualifyingColdSolvesCount)} more independent cold solve(s).`
                        : !gates.recentSuccess.passed
                        ? 'Most recent review was not successful. Review next interval to pass Gate D.'
                        : 'All 4 gates passed! Eligible for automatic lock transition on next review.'}
                    </span>
                  )}

                  <Link to={`/problems/${problem.id}`} className={styles.detailLink}>
                    <span>Inspect Problem</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
