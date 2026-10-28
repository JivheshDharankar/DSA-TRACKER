import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CheckCircle2,
  Lock,
  Repeat,
  ShieldCheck,
  Sparkles,
  Unlock,
  XCircle,
} from 'lucide-react';
import { fetchMasteryOverview } from '../api/mastery.api';
import { ProblemMasteryOverviewItem } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { cx } from '../components/ui/cx';
import {
  difficultyTone,
  masteryTone,
  retentionTone,
} from '../components/problems/badgeTones';
import { formatCalendarDate } from '../utils/date.utils';
import { getErrorMessage } from '../utils/error.utils';
import styles from './LockedProblemsPage.module.css';

/**
 * DSA Tracker — Locked Problems / proof-of-learning vault
 * ======================================================
 * The overview half of the locked-mastery feature. A single `GET /mastery/overview` call
 * returns every problem with its server-evaluated four gates, and this page renders those
 * facts verbatim — it never recomputes eligibility, never offers a manual lock/unlock and
 * never changes a rule. Locking still happens automatically on a review through the
 * backend evaluator, so the only actions here are navigation ones.
 *
 * Behaviour preserved from the previous implementation:
 *   - the same three filters, in the same order, with catalog-wide counts;
 *   - every card still links to `/problems/:id` and the empty state still offers the
 *     Review Queue;
 *   - the four gate descriptions and every per-gate number come from the API payload.
 *
 * What the redesign adds is presentation and state handling: the gates are shown as a
 * labelled list instead of coloured boxes (the pass/fail icon and `sr-only` text carry the
 * state, never colour alone), loading reserves the list with skeletons, a failed request
 * gets a working Retry instead of an inline red strip, and "no problems tracked" is
 * separated from "nothing matches this filter" because they need different next steps.
 */

type FilterMode = 'ALL' | 'LOCKED' | 'IN_PROGRESS';

interface GateGuide {
  letter: string;
  name: string;
  description: React.ReactNode;
}

/** The four gates, worded exactly as `LockedMasteryEvaluator` implements them. */
const GATE_GUIDE: GateGuide[] = [
  {
    letter: 'A',
    name: 'Solved status',
    description: (
      <>
        Problem status must be <strong>Solved</strong>.
      </>
    ),
  },
  {
    letter: 'B',
    name: 'SRS evidence',
    description: (
      <>
        At least <strong>3 successful reviews</strong> (EASY or STRUGGLED), one of them at{' '}
        <strong>stage 3 or later</strong>.
      </>
    ),
  },
  {
    letter: 'C',
    name: 'Independent recall',
    description: (
      <>
        At least <strong>2 successful cold solves</strong> without notes or hints.
      </>
    ),
  },
  {
    letter: 'D',
    name: 'Recent consistency',
    description: (
      <>
        The most recent review must be <strong>EASY or STRUGGLED</strong>.
      </>
    ),
  },
];

const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export const LockedProblemsPage: React.FC = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState<ProblemMasteryOverviewItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Bulk 2-query fetch (zero N+1) — unchanged.
      const data = await fetchMasteryOverview();
      setItems(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load locked problems.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const stats = useMemo(() => {
    let locked = 0;
    let readyToLock = 0;

    for (const item of items) {
      if (item.problem.masteryStatus === 'LOCKED') {
        locked += 1;
      } else if (item.isEligible) {
        readyToLock += 1;
      }
    }

    return {
      total: items.length,
      locked,
      inProgress: items.length - locked,
      readyToLock,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filterMode === 'LOCKED') {
      return items.filter((item) => item.problem.masteryStatus === 'LOCKED');
    }
    if (filterMode === 'IN_PROGRESS') {
      return items.filter((item) => item.problem.masteryStatus !== 'LOCKED');
    }
    return items;
  }, [items, filterMode]);

  const filterOptions: Array<{ key: FilterMode; label: string; count: number }> = [
    { key: 'ALL', label: 'All problems', count: stats.total },
    { key: 'LOCKED', label: 'Locked mastery', count: stats.locked },
    { key: 'IN_PROGRESS', label: 'In progress', count: stats.inProgress },
  ];

  const isFilteredViewEmpty = filteredItems.length === 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.iconTile} aria-hidden="true">
            <Lock size={20} />
          </span>
          <div className={styles.headingText}>
            <h2 className={styles.title}>Locked Problems</h2>
            <p className={styles.subtitle}>
              A problem is sealed only after it passes all four proof-of-learning gates.
              Any failed recall reopens it for recovery, so a lock always reflects current
              recall — not a one-off solve.
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          {!isLoading && !error ? (
            <>
              <Badge tone="warning" shape="pill" dot>
                {stats.locked} locked
              </Badge>
              <Badge tone="neutral" shape="pill">
                {stats.inProgress} in progress
              </Badge>
            </>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Repeat size={14} />}
            onClick={() => navigate('/review')}
          >
            Review Queue
          </Button>
        </div>
      </header>

      {error ? (
        <ErrorState
          variant="section"
          title="We couldn't load your mastery overview"
          message={error}
          onRetry={loadOverview}
          isRetrying={isLoading}
          retryLabel="Retry"
        />
      ) : isLoading && items.length === 0 ? (
        <LockedListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          variant="full"
          icon={<ShieldCheck size={24} />}
          title="No problems to qualify yet"
          description="Locked mastery is earned problem by problem. Add problems to a tracker, mark them Solved, then review them to pass the four gates — they appear here as soon as they are tracked."
          primaryAction={
            <Button onClick={() => navigate('/college-dsa')}>College DSA</Button>
          }
          secondaryAction={
            <Button variant="secondary" onClick={() => navigate('/personal-dsa')}>
              Personal DSA
            </Button>
          }
        />
      ) : (
        <>
          <dl className={styles.stats}>
            <StatTile
              label="Locked"
              value={stats.locked}
              hint="Sealed by verified recall"
              tone="warning"
            />
            <StatTile
              label="In progress"
              value={stats.inProgress}
              hint="Still passing the gates"
              tone="info"
            />
            <StatTile
              label="Ready to lock"
              value={stats.readyToLock}
              hint="All four gates met"
              tone="accent"
            />
          </dl>

          <Card variant="raised" className={styles.gatesCard} aria-labelledby="gate-guide-heading">
            <div className={styles.gatesHeader}>
              <h2 className={styles.gatesTitle} id="gate-guide-heading">
                <ShieldCheck size={16} className={styles.sectionIcon} aria-hidden="true" />
                The four qualification gates
              </h2>
              <Badge tone="neutral">All four required</Badge>
            </div>

            <p className={styles.gatesDesc}>
              Every gate is evaluated from your revision history on each request. A later HINT
              or FORGOT review unlocks the problem again so it can be re-earned.
            </p>

            <ol className={styles.gateGuideList}>
              {GATE_GUIDE.map((gate) => (
                <li key={gate.letter} className={styles.gateGuideItem}>
                  <span className={styles.gateLetter} aria-hidden="true">
                    {gate.letter}
                  </span>
                  <div className={styles.gateGuideBody}>
                    <span className={styles.gateGuideName}>
                      <span className="sr-only">Gate </span>
                      {gate.name}
                    </span>
                    <span className={styles.gateGuideText}>{gate.description}</span>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <section className={styles.controls} aria-label="Filter problems by mastery status">
            <div className={styles.filterGroup} role="group" aria-label="Mastery status filters">
              {filterOptions.map((option) => {
                const isActive = filterMode === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={cx(styles.filterBtn, isActive && styles.filterBtnActive)}
                    aria-pressed={isActive}
                    onClick={() => setFilterMode(option.key)}
                  >
                    {option.label}
                    <span className={styles.filterCount}>{option.count}</span>
                  </button>
                );
              })}
            </div>

            <p className={styles.resultSummary} aria-live="polite">
              Showing <strong>{filteredItems.length}</strong> of{' '}
              <strong>{stats.total}</strong> problems
            </p>
          </section>

          {isFilteredViewEmpty ? (
            filterMode === 'LOCKED' ? (
              <EmptyState
                variant="full"
                icon={<Lock size={24} />}
                title="No problems locked yet"
                description="Nothing has passed all four gates so far. Keep the reviews coming — a lock is applied automatically the moment every gate is satisfied."
                primaryAction={<Button onClick={() => navigate('/review')}>Go to Review Queue</Button>}
                secondaryAction={
                  <Button variant="secondary" onClick={() => setFilterMode('ALL')}>
                    Show all problems
                  </Button>
                }
              />
            ) : (
              <EmptyState
                variant="full"
                icon={<Unlock size={24} />}
                title="Every tracked problem is locked"
                description="All problems currently tracked have passed the four gates. New problems start in progress as soon as they are added."
                primaryAction={
                  <Button onClick={() => setFilterMode('LOCKED')}>Show locked mastery</Button>
                }
                secondaryAction={
                  <Button variant="secondary" onClick={() => navigate('/college-dsa')}>
                    Add a problem
                  </Button>
                }
              />
            )
          ) : (
            <ul className={styles.problemList}>
              {filteredItems.map((item) => (
                <li key={item.problem.id}>
                  <ProblemMasteryCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ stat tile */

interface StatTileProps {
  label: string;
  value: number;
  hint: string;
  tone?: 'accent' | 'warning' | 'info';
}

const StatTile: React.FC<StatTileProps> = ({ label, value, hint, tone }) => (
  <div className={styles.statTile}>
    <dt className={styles.statLabel}>{label}</dt>
    <dd className={styles.statBody}>
      <span
        className={cx(
          styles.statValue,
          tone === 'accent' && styles.statValueAccent,
          tone === 'warning' && styles.statValueWarning,
          tone === 'info' && styles.statValueInfo
        )}
      >
        {value}
      </span>
      <span className={styles.statHint}>{hint}</span>
    </dd>
  </div>
);

/* ------------------------------------------------------------------ gate list */

interface GateItemProps {
  letter: string;
  title: string;
  detail: React.ReactNode;
  passed: boolean;
}

const GateItem: React.FC<GateItemProps> = ({ letter, title, detail, passed }) => (
  <li className={cx(styles.gate, passed && styles.gatePassed)}>
    {passed ? (
      <CheckCircle2 size={16} className={styles.gateIconPass} aria-hidden="true" />
    ) : (
      <XCircle size={16} className={styles.gateIconFail} aria-hidden="true" />
    )}

    <div className={styles.gateBody}>
      <span className={styles.gateTitle}>
        <span className={styles.gateLetterInline} aria-hidden="true">
          {letter}
        </span>
        {title}
      </span>
      <span className={styles.gateDetail}>
        <span className="sr-only">{passed ? 'Passed. ' : 'Not passed. '}</span>
        {detail}
      </span>
    </div>
  </li>
);

/* ------------------------------------------------------------------ problem card */

interface ProblemMasteryCardProps {
  item: ProblemMasteryOverviewItem;
}

const ProblemMasteryCard: React.FC<ProblemMasteryCardProps> = ({ item }) => {
  const { problem, gates, isEligible } = item;
  const isLocked = problem.masteryStatus === 'LOCKED';

  const passedGates = [gates.solved, gates.srsEvidence, gates.coldRecall, gates.recentSuccess].filter(
    (gate) => gate.passed
  ).length;

  const missingReviews = Math.max(
    0,
    gates.srsEvidence.requiredReviewsCount - gates.srsEvidence.successfulReviewsCount
  );
  const missingColdSolves = Math.max(
    0,
    gates.coldRecall.requiredColdSolvesCount - gates.coldRecall.qualifyingColdSolvesCount
  );

  /** The single next step for an unlocked problem, based on the first failing gate. */
  const nextAction = (): React.ReactNode => {
    if (!gates.solved.passed) {
      return (
        <>
          Mark the problem as <strong>Solved</strong> to pass Gate A.
        </>
      );
    }

    if (!gates.srsEvidence.passed) {
      const needs: string[] = [];
      if (missingReviews > 0) {
        needs.push(plural(missingReviews, 'more successful review'));
      }
      if (!gates.srsEvidence.hasStageThreeMilestone) {
        needs.push('a review at stage 3 or later');
      }

      return <>Needs {needs.join(' and ')} to pass Gate B.</>;
    }

    if (!gates.coldRecall.passed) {
      return (
        <>
          Needs {plural(missingColdSolves, 'more independent cold solve')} to pass Gate C.
        </>
      );
    }

    if (!gates.recentSuccess.passed) {
      return (
        <>
          The latest review was not successful — pass <strong>Gate D</strong> on the next
          review.
        </>
      );
    }

    return <>All four gates are met — the problem locks on its next review.</>;
  };

  return (
    <Card
      className={cx(styles.problemCard, isLocked ? styles.problemCardLocked : undefined)}
      aria-labelledby={`mastery-${problem.id}-title`}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardIdentity}>
          <span className={styles.sNo}>#{problem.sNo}</span>
          <Badge tone="neutral" shape="pill">
            {problem.section === 'COLLEGE' ? 'College' : 'Personal'}
          </Badge>
          <Link
            to={`/problems/${problem.id}`}
            className={styles.problemTitle}
            id={`mastery-${problem.id}-title`}
          >
            {problem.title}
          </Link>
        </div>

        <div className={styles.cardBadges}>
          <Badge tone={difficultyTone(problem.difficulty)} dot>
            {problem.difficulty}
          </Badge>
          {/* "Locked" retention would repeat the seal badge below, so only the SRS
              retention steps are shown here. */}
          {problem.retentionLevel !== 'Locked' ? (
            <Badge tone={retentionTone(problem.retentionLevel)}>{problem.retentionLevel}</Badge>
          ) : null}
          <Badge tone={masteryTone(problem.masteryStatus)}>
            {isLocked ? (
              <>
                <Lock size={11} aria-hidden="true" />
                <span>Locked · v{problem.lockVersion}</span>
              </>
            ) : (
              <>
                <Unlock size={11} aria-hidden="true" />
                <span>In progress</span>
              </>
            )}
          </Badge>
          {!isLocked && isEligible ? (
            <Badge tone="success" dot>
              Ready to lock
            </Badge>
          ) : null}
        </div>
      </div>

      <ul className={styles.gateList} role="list">
        <GateItem
          letter="A"
          title="Solved"
          passed={gates.solved.passed}
          detail={
            gates.solved.passed
              ? 'Status: Solved'
              : `Status: ${gates.solved.status} · needs ${gates.solved.requiredStatus}`
          }
        />
        <GateItem
          letter="B"
          title="SRS evidence"
          passed={gates.srsEvidence.passed}
          detail={
            <>
              {gates.srsEvidence.successfulReviewsCount}/
              {gates.srsEvidence.requiredReviewsCount} reviews · max stage{' '}
              {gates.srsEvidence.maxStageReached} · stage 3+{' '}
              {gates.srsEvidence.hasStageThreeMilestone ? 'reached' : 'pending'}
            </>
          }
        />
        <GateItem
          letter="C"
          title="Cold solves"
          passed={gates.coldRecall.passed}
          detail={
            <>
              {gates.coldRecall.qualifyingColdSolvesCount}/
              {gates.coldRecall.requiredColdSolvesCount} independent solves
            </>
          }
        />
        <GateItem
          letter="D"
          title="Recent review"
          passed={gates.recentSuccess.passed}
          detail={
            gates.recentSuccess.latestOutcome
              ? `Last outcome: ${gates.recentSuccess.latestOutcome}`
              : 'No reviews yet'
          }
        />
      </ul>

      <div className={styles.cardFooter}>
        {isLocked ? (
          <p className={styles.footerNoteLocked}>
            <Sparkles size={13} aria-hidden="true" />
            <span>
              Locked
              {problem.lockedAt ? ` on ${formatCalendarDate(problem.lockedAt)}` : ''} · seal v
              {problem.lockVersion}. A failed recall unlocks it automatically.
            </span>
          </p>
        ) : (
          <p className={styles.footerNote}>
            <span className={styles.gateProgress}>
              {passedGates}/4 gates passed
            </span>
            <span>{nextAction()}</span>
          </p>
        )}

        <Link to={`/problems/${problem.id}`} className={styles.inspectLink}>
          Inspect problem
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------------ skeleton */

const LockedListSkeleton: React.FC = () => (
  <div className={styles.skeletonStack} role="status" aria-busy="true">
    <span className="sr-only">Loading locked problems</span>

    {[0, 1, 2].map((index) => (
      <Card key={index} className={styles.problemCard} aria-hidden="true">
        <div className={styles.cardHeader}>
          <div className={styles.cardIdentity}>
            <Skeleton width={40} height={18} />
            <Skeleton width={120} height={18} />
            <Skeleton width={200} height={18} />
          </div>
          <Skeleton width={140} height={20} />
        </div>

        <div className={styles.skeletonGates}>
          {[0, 1, 2, 3].map((gate) => (
            <Skeleton key={gate} width="100%" height={52} />
          ))}
        </div>

        <div className={styles.cardFooter}>
          <Skeleton width={260} height={14} />
          <Skeleton width={120} height={14} />
        </div>
      </Card>
    ))}
  </div>
);
