import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Edit2,
  Trash2,
  FileText,
  AlertCircle,
  History,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers,
} from 'lucide-react';
import { fetchProblemById, updateProblem, deleteProblem } from '../api/problems.api';
import { fetchProblemHistory } from '../api/reviews.api';
import {
  fetchProblemPatterns,
  syncProblemPatterns,
} from '../api/patterns.api';
import { fetchProblemMastery } from '../api/mastery.api';
import { getSafeUrl } from '../utils/url.util';
import {
  Problem,
  UpdateProblemInput,
  RevisionHistoryItem,
  ProblemPatternAttachment,
  PatternConfidence,
  ProblemMasteryDetails,
} from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { cx } from '../components/ui/cx';
import { DifficultyBadge } from '../components/problems/DifficultyBadge';
import { RetentionBadge } from '../components/problems/RetentionBadge';
import { StatusBadge } from '../components/problems/StatusBadge';
import { MasteryBadge } from '../components/problems/MasteryBadge';
import { ProblemModal } from '../components/problems/ProblemModal';
import { DeleteProblemDialog } from '../components/problems/DeleteProblemDialog';
import { RevisionHistoryList } from '../components/reviews/RevisionHistoryList';
import { SrsProgressionStepper } from '../components/reviews/SrsProgressionStepper';
import { PatternPickerModal } from '../components/patterns/PatternPickerModal';
import { AIAssistantPanel } from '../components/ai/AIAssistantPanel';
import { formatCalendarDate } from '../utils/date.utils';
import { getErrorMessage } from '../utils/error.utils';
import styles from '../styles/ProblemDetail.module.css';

/**
 * DSA Tracker — Problem Detail (Phase 7)
 * =====================================
 * The page keeps exactly the same data, endpoints, routes and actions as before; only the
 * presentation moved onto the Phase 0/2 design system and the Phase 3 shell.
 *
 * Responsive metadata
 *   The metadata is a `<dl>` of label/value pairs laid out 1-up (< 640px), 2-up
 *   (640–1023px) and 3-up (>= 1024px), so a twelve-field record reads as a single tidy
 *   column on a phone and as a scannable grid on a desktop. The identity block stacks on
 *   small screens and becomes title-left / links-right from 768px. The layout rule is
 *   documented in `ProblemDetail.module.css`.
 *
 * Page states
 *   - loading        `<Skeleton>` shapes that mirror the real sections, in one
 *                    `role="status"` region, so the page does not jump when data arrives;
 *   - missing        a distinct `EmptyState` ("Problem not found") when the API reports
 *                    `NOT_FOUND`, with a way back;
 *   - error          `ErrorState` with a real retry when the request itself failed;
 *   - populated      the record itself.
 *   The API client rejects with the backend error envelope (`{ message, code }`), so the
 *   missing case is identified by `code`, not by matching message text.
 *
 * Accessibility
 *   The topbar owns the page `<h1>` (`getRouteTitle`), the problem title is the `<h2>` and
 *   every section is an `<h3>`, so the page is navigable by heading. Decorative icons are
 *   `aria-hidden`, two of the four mastery gates carry a screen-reader pass/fail status
 *   instead of relying on colour, every control is a real button or link with a visible
 *   `:focus-visible` ring, and dialog triggers declare `aria-haspopup`.
 *
 * Out of scope in this phase: the shared badge components, the shared dialogs
 * (`ProblemModal`, `DeleteProblemDialog`, `PatternPickerModal`), `SrsProgressionStepper`
 * and `RevisionHistoryList`. They are used unchanged.
 */

type FailureKind = 'NOT_FOUND' | 'ERROR';

interface LoadFailure {
  kind: FailureKind;
  message: string;
}

const NOT_FOUND_DEFAULT = 'This problem does not exist or you do not have permission to view it.';

/** The API client rejects with `{ message, code }` — a missing or inaccessible problem
 *  arrives as `code: 'NOT_FOUND'`, which is what separates it from a transport failure. */
const failureKindFor = (err: unknown): FailureKind => {
  if (typeof err === 'object' && err !== null) {
    const code = (err as { code?: unknown }).code;
    if (code === 'NOT_FOUND') {
      return 'NOT_FOUND';
    }
  }
  return 'ERROR';
};

const sectionLabel = (section: Problem['section']): string =>
  section === 'PERSONAL' ? 'Personal DSA' : 'College DSA';

interface MetaItemProps {
  label: string;
  children: React.ReactNode;
  valueClassName?: string;
}

const MetaItem: React.FC<MetaItemProps> = ({ label, children, valueClassName }) => (
  <div className={styles.metaItem}>
    <dt className={styles.metaLabel}>{label}</dt>
    <dd className={cx(styles.metaValue, valueClassName)}>{children}</dd>
  </div>
);

interface GateProps {
  title: string;
  detail: React.ReactNode;
  passed: boolean;
}

const Gate: React.FC<GateProps> = ({ title, detail, passed }) => (
  <li className={cx(styles.gate, passed && styles.gatePassed)}>
    {passed ? (
      <CheckCircle2 size={18} className={styles.gateIconPass} aria-hidden="true" />
    ) : (
      <XCircle size={18} className={styles.gateIconFail} aria-hidden="true" />
    )}
    <div className={styles.gateContent}>
      <span className={styles.gateTitle}>{title}</span>
      <span className={styles.gateSubtitle}>
        <span className="sr-only">{passed ? 'Passed. ' : 'Not passed. '}</span>
        {detail}
      </span>
    </div>
  </li>
);

/**
 * Loading placeholder. Uses the same page frame as the real layout so the sections do not
 * jump when the record arrives. The shapes are decorative; the single `role="status"`
 * region announces the state once.
 */
const ProblemDetailSkeleton: React.FC = () => (
  <div className={styles.page} role="status" aria-busy="true">
    <span className="sr-only">Loading problem details</span>

    <div className={styles.skeletonTopBar}>
      <Skeleton shape="block" width={200} height={36} />
    </div>

    <Card variant="compact" className={styles.skeletonStack}>
      <Skeleton shape="block" width={140} height={22} />
      <Skeleton shape="block" width="55%" height={30} />
    </Card>

    <Card variant="compact" className={styles.skeletonStack}>
      <Skeleton shape="block" height={180} />
    </Card>

    <Card variant="compact" className={styles.skeletonStack}>
      <Skeleton shape="block" height={150} />
    </Card>
  </div>
);

export const ProblemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [history, setHistory] = useState<RevisionHistoryItem[]>([]);
  const [patterns, setPatterns] = useState<ProblemPatternAttachment[]>([]);
  const [mastery, setMastery] = useState<ProblemMasteryDetails | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [failure, setFailure] = useState<LoadFailure | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!id) return;
    setIsHistoryLoading(true);
    try {
      const historyData = await fetchProblemHistory(id);
      setHistory(historyData.items);
    } catch (err) {
      console.error('Failed to load revision history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [id]);

  const loadPatterns = useCallback(async () => {
    if (!id) return;
    try {
      const patternData = await fetchProblemPatterns(id);
      setPatterns(patternData);
    } catch (err) {
      console.error('Failed to load problem patterns:', err);
    }
  }, [id]);

  const loadMastery = useCallback(async () => {
    if (!id) return;
    try {
      const masteryData = await fetchProblemMastery(id);
      setMastery(masteryData);
    } catch (err) {
      console.error('Failed to load problem mastery details:', err);
    }
  }, [id]);

  const loadProblem = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setFailure(null);
    try {
      const data = await fetchProblemById(id);
      setProblem(data);
      loadHistory();
      loadPatterns();
      loadMastery();
    } catch (err: unknown) {
      const kind = failureKindFor(err);
      setFailure({
        kind,
        message: getErrorMessage(
          err,
          kind === 'NOT_FOUND' ? NOT_FOUND_DEFAULT : 'Something went wrong loading this problem.'
        ),
      });
    } finally {
      setIsLoading(false);
    }
  }, [id, loadHistory, loadPatterns, loadMastery]);

  useEffect(() => {
    loadProblem();
  }, [loadProblem]);

  const handleUpdate = async (_problemId: string, updateData: UpdateProblemInput) => {
    if (!id) return;
    const updated = await updateProblem(id, updateData);
    setProblem(updated);
    await loadMastery();
  };

  const handleDelete = async (problemId: string) => {
    await deleteProblem(problemId);
    const targetPath = problem?.section === 'PERSONAL' ? '/personal-dsa' : '/college-dsa';
    navigate(targetPath, { replace: true });
  };

  const handleSavePatterns = async (
    newPatterns: Array<{ patternId: string; confidence: PatternConfidence; isPrimary: boolean }>
  ) => {
    if (!id) return;
    await syncProblemPatterns(id, newPatterns);
    await loadPatterns();
    await loadMastery();
  };

  const goToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  if (isLoading) {
    return <ProblemDetailSkeleton />;
  }

  if (failure?.kind === 'NOT_FOUND') {
    return (
      <div className={styles.page}>
        <EmptyState
          variant="full"
          titleAs="h2"
          icon={<AlertCircle size={24} />}
          title="Problem Not Found"
          description={failure.message || NOT_FOUND_DEFAULT}
          primaryAction={
            <Button
              variant="secondary"
              iconLeft={<ArrowLeft size={16} />}
              onClick={goToDashboard}
            >
              Return to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  if (failure || !problem) {
    return (
      <div className={styles.page}>
        <ErrorState
          variant="section"
          title="We couldn't load this problem."
          message={failure?.message || 'Something went wrong loading this problem.'}
          onRetry={loadProblem}
          retryLabel="Retry"
          actions={
            <Button variant="ghost" size="sm" onClick={goToDashboard}>
              Return to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  const backUrl = problem.section === 'PERSONAL' ? '/personal-dsa' : '/college-dsa';
  const collegeUrl = getSafeUrl(problem.collegeLink);
  const leetcodeUrl = getSafeUrl(problem.leetcodeLink);
  const isLocked = problem.masteryStatus === 'LOCKED';

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to={backUrl} className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to {sectionLabel(problem.section)}</span>
        </Link>

        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Edit2 size={15} />}
            onClick={() => setIsEditModalOpen(true)}
            aria-haspopup="dialog"
          >
            Edit Problem
          </Button>
          <Button
            variant="danger"
            size="sm"
            iconLeft={<Trash2 size={15} />}
            onClick={() => setIsDeleteDialogOpen(true)}
            aria-haspopup="dialog"
          >
            Delete Problem
          </Button>
        </div>
      </div>

      <Card variant="compact" className={styles.identityCard}>
        <div className={styles.identity}>
          <div className={styles.identityMain}>
            <div className={styles.identityTags}>
              <Badge tone="accent" shape="compact">
                {problem.section} DSA #{problem.sNo}
              </Badge>
              <MasteryBadge status={problem.masteryStatus} />
            </div>
            <h2 className={styles.title}>{problem.title}</h2>
          </div>

          {(collegeUrl || leetcodeUrl) && (
            <div className={styles.links}>
              {collegeUrl && (
                <a
                  href={collegeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                  title="Open College Problem Link"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  <span>College Link ↗</span>
                </a>
              )}
              {leetcodeUrl && (
                <a
                  href={leetcodeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                  title="Open LeetCode Problem Link"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  <span>LeetCode Link ↗</span>
                </a>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* AI assistance (Phase 2B): suggestions only. The panel can read the problem and
          append notes after an explicit confirmation; it has no access to mastery or SRS. */}
      <AIAssistantPanel problem={problem} onNotesSaved={setProblem} />

      <Card variant="compact" className={styles.bodyCard}>
        <section className={styles.section} aria-labelledby="problem-details-heading">
          <h3 className={styles.sectionHeading} id="problem-details-heading">
            Problem Details
          </h3>

          <dl className={styles.metaGrid}>
            <MetaItem label="Topic">{problem.topic}</MetaItem>

            <MetaItem label="Difficulty">
              <DifficultyBadge difficulty={problem.difficulty} />
            </MetaItem>

            <MetaItem label="Source">{problem.source}</MetaItem>

            <MetaItem label="LeetCode #">
              {problem.leetcodeNumber ? `#${problem.leetcodeNumber}` : '—'}
            </MetaItem>

            <MetaItem label="Status">
              <StatusBadge status={problem.status} />
            </MetaItem>

            <MetaItem label="Retention Level">
              <RetentionBadge retention={problem.retentionLevel} />
            </MetaItem>

            <MetaItem label="Mastery Status">
              {/* `showUnlocked` is what keeps this cell from rendering an empty box for
                  every problem that has not reached locked mastery. */}
              <MasteryBadge status={problem.masteryStatus} showUnlocked />
              {problem.lockedAt && (
                <span className={styles.masteryLockedNote}>
                  Locked {formatCalendarDate(problem.lockedAt)} (v{problem.lockVersion})
                </span>
              )}
            </MetaItem>

            {/* `dateLearned` is a calendar date; formatting it in local time shifted it a
                day for users behind UTC. `formatCalendarDate` is the app-wide UTC
                calendar-day formatter. */}
            <MetaItem label="Date Learned">{formatCalendarDate(problem.dateLearned)}</MetaItem>

            <MetaItem label="Stage & Interval" valueClassName={styles.metaValueMono}>
              Stage {problem.repetitionStage ?? 0} ({problem.intervalDays ?? 0}d)
            </MetaItem>

            <MetaItem label="Next Review" valueClassName={styles.metaValueAccent}>
              {formatCalendarDate(problem.nextReviewDate)}
            </MetaItem>

            <MetaItem label="Last Reviewed">
              {problem.lastReviewedAt ? formatCalendarDate(problem.lastReviewedAt) : 'Never'}
            </MetaItem>

            <MetaItem label="Created" valueClassName={styles.metaValueMuted}>
              {new Date(problem.createdAt).toLocaleString()}
            </MetaItem>
          </dl>
        </section>

        {/* Spaced Repetition Progression Stepper & Timeline (shared component, unchanged) */}
        <section className={styles.section} aria-label="Spaced repetition progression">
          <SrsProgressionStepper
            repetitionStage={problem.repetitionStage ?? 0}
            intervalDays={problem.intervalDays ?? 0}
            nextReviewDate={problem.nextReviewDate}
            lastReviewedAt={problem.lastReviewedAt}
            retentionLevel={problem.retentionLevel}
            history={history}
          />
        </section>

        {/* Locked Mastery & 4-Gate Qualification Panel */}
        <section className={styles.section} aria-labelledby="problem-mastery-heading">
          <div className={styles.masteryHeading}>
            <h3 className={styles.sectionHeading} id="problem-mastery-heading">
              <ShieldCheck
                size={20}
                aria-hidden="true"
                className={isLocked ? styles.masteryIconLocked : styles.masteryIcon}
              />
              <span>Proof-of-Learning Mastery &amp; Qualification</span>
            </h3>
            {mastery && <MasteryBadge status={mastery.masteryStatus} />}
          </div>

          <div className={cx(styles.masteryCard, isLocked && styles.masteryCardLocked)}>
            {mastery && (
              <>
                <p className={styles.masterySummary}>
                  {mastery.masteryStatus === 'LOCKED' ? (
                    <span className={styles.masterySummaryLocked}>
                      ★ Problem is LOCKED in mastery. Locked on{' '}
                      {mastery.lockedAt ? new Date(mastery.lockedAt).toLocaleString() : 'N/A'}. (Lock
                      version: v{mastery.lockVersion})
                    </span>
                  ) : mastery.isEligible ? (
                    <span className={styles.masterySummaryEligible}>
                      ✓ All 4 qualification gates are satisfied! Problem qualifies for Locked mastery
                      status.
                    </span>
                  ) : (
                    <span>
                      Requires passing all 4 evidence-based learning gates simultaneously to achieve
                      Locked status.
                    </span>
                  )}
                </p>

                <ul className={styles.gates} role="list">
                  <Gate
                    title="Gate A: Solved Status"
                    passed={mastery.gates.solved.passed}
                    detail={<>Status: {mastery.gates.solved.status} (Required: Solved)</>}
                  />

                  <Gate
                    title="Gate B: Spaced Reviews"
                    passed={mastery.gates.srsEvidence.passed}
                    detail={
                      <>
                        {mastery.gates.srsEvidence.successfulReviewsCount}/
                        {mastery.gates.srsEvidence.requiredReviewsCount} successes &bull; Stage
                        &ge;3: {mastery.gates.srsEvidence.hasStageThreeMilestone ? 'Yes' : 'No'} (Max:{' '}
                        {mastery.gates.srsEvidence.maxStageReached})
                      </>
                    }
                  />

                  <Gate
                    title="Gate C: Cold Solves"
                    passed={mastery.gates.coldRecall.passed}
                    detail={
                      <>
                        {mastery.gates.coldRecall.qualifyingColdSolvesCount}/
                        {mastery.gates.coldRecall.requiredColdSolvesCount} successful cold solves
                      </>
                    }
                  />

                  <Gate
                    title="Gate D: Recent Review"
                    passed={mastery.gates.recentSuccess.passed}
                    detail={
                      <>
                        Latest:{' '}
                        {mastery.gates.recentSuccess.latestOutcome
                          ? `${mastery.gates.recentSuccess.latestOutcome}`
                          : 'No reviews'}
                      </>
                    }
                  />
                </ul>
              </>
            )}
          </div>
        </section>

        {/* Algorithmic Patterns Section */}
        <section className={styles.section} aria-labelledby="problem-patterns-heading">
          <div className={styles.sectionHeadingRow}>
            <h3 className={styles.sectionHeading} id="problem-patterns-heading">
              <Layers size={18} aria-hidden="true" />
              <span>Algorithmic Patterns ({patterns.length})</span>
            </h3>

            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Sparkles size={14} />}
              onClick={() => setIsPatternModalOpen(true)}
              aria-haspopup="dialog"
            >
              Manage Patterns
            </Button>
          </div>

          {patterns.length > 0 ? (
            <div className={styles.patternList}>
              {patterns.map((att) => {
                const patternObj = att.pattern;
                const patId = patternObj?.id || (att as unknown as { patternId: string }).patternId;
                const patName = patternObj?.name || 'Pattern';

                return (
                  <Link
                    key={att.id || patId}
                    to={`/patterns/${patId}`}
                    className={styles.patternPill}
                    title="View pattern breakdown in library"
                  >
                    <span className={styles.patternName}>{patName}</span>
                    <Badge
                      tone={
                        att.confidence === 'HIGH'
                          ? 'success'
                          : att.confidence === 'MEDIUM'
                            ? 'warning'
                            : 'neutral'
                      }
                      shape="pill"
                    >
                      {att.confidence}
                    </Badge>
                    {att.isPrimary && (
                      <Badge tone="accent" shape="pill">
                        Primary
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className={styles.patternEmpty}>
              No algorithmic patterns tagged yet.{' '}
              <button
                type="button"
                onClick={() => setIsPatternModalOpen(true)}
                className={styles.patternEmptyAction}
              >
                Assign patterns
              </button>{' '}
              to track pattern recognition and transfer mastery.
            </p>
          )}
        </section>

        {/* Notes & Invariants */}
        <section className={styles.section} aria-labelledby="problem-notes-heading">
          <h3 className={styles.sectionHeading} id="problem-notes-heading">
            <FileText size={18} aria-hidden="true" />
            <span>Approach, Invariants &amp; Notes</span>
          </h3>

          {problem.notes && problem.notes.trim() ? (
            <div className={styles.notes}>{problem.notes}</div>
          ) : (
            <div className={cx(styles.notes, styles.notesEmpty)}>
              No notes or invariants recorded for this problem yet. Click Edit to document your
              solution approach.
            </div>
          )}
        </section>

        {/* Revision History (shared list component, unchanged) */}
        <section className={styles.section} aria-labelledby="problem-history-heading">
          <h3 className={styles.sectionHeading} id="problem-history-heading">
            <History size={18} aria-hidden="true" />
            <span>Revision History ({history.length})</span>
          </h3>

          <RevisionHistoryList history={history} isLoading={isHistoryLoading} />
        </section>
      </Card>

      <ProblemModal
        isOpen={isEditModalOpen}
        section={problem.section}
        problemToEdit={problem}
        onClose={() => setIsEditModalOpen(false)}
        onSubmitCreate={async () => {}}
        onSubmitUpdate={handleUpdate}
      />

      <DeleteProblemDialog
        isOpen={isDeleteDialogOpen}
        problem={problem}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirmDelete={handleDelete}
      />

      <PatternPickerModal
        isOpen={isPatternModalOpen}
        problemTitle={problem.title}
        currentAttachments={patterns}
        onClose={() => setIsPatternModalOpen(false)}
        onSave={handleSavePatterns}
      />
    </div>
  );
};
