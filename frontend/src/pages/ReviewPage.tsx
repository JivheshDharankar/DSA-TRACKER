import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle2, Play, Sparkles } from 'lucide-react';
import { Problem, SectionType } from '../types';
import { fetchDueReviews } from '../api/reviews.api';
import { DifficultyBadge } from '../components/problems/DifficultyBadge';
import { RetentionBadge } from '../components/problems/RetentionBadge';
import { RecallSessionModal } from '../components/reviews/RecallSessionModal';
import { Badge, BadgeTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { getDueBadgeInfo } from '../utils/date.utils';
import { getErrorMessage } from '../utils/error.utils';
import styles from './ReviewPage.module.css';

/**
 * DSA Tracker — Review queue (Phase 8)
 * ====================================
 * The due-revision queue, restyled onto the design tokens and Phase 2 primitives.
 *
 * Behaviour is unchanged: the same `GET /reviews/due` call with the same optional
 * `section` parameter, the same `All / College / Personal` filtering, the same
 * `{totalCount} Due` counter, the same due-badge wording (`getDueBadgeInfo`) and the
 * same hand-off into `RecallSessionModal`, which still reports success through
 * `onSuccess` → refetch.
 *
 * What the restyle changes is presentation and state handling:
 *   - one data state at a time (loading → error → empty → list), so a failed request
 *     can no longer render the "All Caught Up!" panel underneath its own error banner;
 *   - the section filter is a labelled toggle group (`role="group"` + `aria-pressed`)
 *     instead of three unlabelled buttons whose active state was colour-only;
 *   - the loading state is a single `role="status"` region, and the queue is a real
 *     `<ul>` so assistive technology announces how many revisions are waiting.
 *
 * The page title is an `<h2>` because the app shell already renders the document's
 * single `<h1>` ("DSA Tracker").
 */

const SECTION_FILTERS: ReadonlyArray<{ value: SectionType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Sections' },
  { value: 'COLLEGE', label: 'College DSA' },
  { value: 'PERSONAL', label: 'Personal DSA' },
];

/** Due tone is never the only signal — each badge also carries its day-counted label. */
const dueTone = (isOverdue: boolean, isToday: boolean): BadgeTone =>
  isOverdue ? 'danger' : isToday ? 'warning' : 'info';

export const ReviewPage: React.FC = () => {
  const navigate = useNavigate();
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
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Due Revisions</h2>
          <Badge tone="accent" shape="pill">
            {totalCount} Due
          </Badge>
        </div>

        <div
          className={styles.filters}
          role="group"
          aria-label="Filter due revisions by section"
        >
          {SECTION_FILTERS.map((filter) => {
            const isActive = selectedSection === filter.value;
            return (
              <Button
                key={filter.value}
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={styles.filterButton}
                aria-pressed={isActive}
                onClick={() => setSelectedSection(filter.value)}
              >
                {filter.label}
              </Button>
            );
          })}
        </div>
      </div>

      {error ? (
        <ErrorState
          variant="section"
          title="We couldn't load your due revisions"
          message={error}
          onRetry={loadDueProblems}
          retryLabel="Retry"
        />
      ) : isLoading ? (
        <div className={styles.loadingState} role="status" aria-busy="true">
          <span className="sr-only">Loading due revision queue</span>
          <p className={styles.loadingCaption} aria-hidden="true">
            Loading due revision queue…
          </p>
          {[0, 1, 2].map((index) => (
            <div key={index} className={styles.skeletonCard} aria-hidden="true">
              <div className={styles.skeletonRow}>
                <Skeleton width={44} height={20} />
                <Skeleton width={72} height={20} />
                <Skeleton width={180} height={20} />
              </div>
              <div className={styles.skeletonRow}>
                <Skeleton width={64} height={20} />
                <Skeleton width={84} height={20} />
                <Skeleton width={112} height={20} />
              </div>
            </div>
          ))}
        </div>
      ) : dueProblems.length === 0 ? (
        <EmptyState
          variant="full"
          titleAs="h2"
          icon={<CheckCircle2 size={24} />}
          title="All Caught Up!"
          description="Zero problems are currently due for spaced repetition. Solve new problems or relax until your next scheduled interval!"
          primaryAction={
            <Button
              iconLeft={<Sparkles size={15} aria-hidden="true" />}
              onClick={() => navigate('/personal-dsa')}
            >
              Personal DSA
            </Button>
          }
          secondaryAction={
            <Button
              variant="secondary"
              iconLeft={<BookOpen size={15} aria-hidden="true" />}
              onClick={() => navigate('/college-dsa')}
            >
              College DSA
            </Button>
          }
        />
      ) : (
        <ul className={styles.queueList}>
          {dueProblems.map((prob) => {
            const dueInfo = getDueBadgeInfo(prob.nextReviewDate);
            return (
              <li key={prob.id}>
                <Card className={styles.dueCard}>
                  <div className={styles.cardLeft}>
                    <div className={styles.cardTop}>
                      <Badge tone="accent" shape="compact">
                        #{prob.sNo}
                      </Badge>
                      <Badge tone="neutral" shape="compact">
                        {prob.section}
                      </Badge>
                      <Link to={`/problems/${prob.id}`} className={styles.problemTitle}>
                        {prob.title}
                      </Link>
                    </div>

                    <div className={styles.cardMeta}>
                      <DifficultyBadge difficulty={prob.difficulty} />
                      <RetentionBadge retention={prob.retentionLevel} />
                      <span className={styles.topicChip}>{prob.topic}</span>
                      <span className={styles.stageValue}>
                        Stage {prob.repetitionStage} ({prob.intervalDays}d)
                      </span>
                      <Badge tone={dueTone(dueInfo.isOverdue, dueInfo.isToday)} shape="compact" dot>
                        {dueInfo.label}
                      </Badge>
                    </div>
                  </div>

                  <Button
                    className={styles.startAction}
                    iconLeft={<Play size={15} aria-hidden="true" />}
                    onClick={() => handleStartRevision(prob)}
                  >
                    Start Revision
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
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
