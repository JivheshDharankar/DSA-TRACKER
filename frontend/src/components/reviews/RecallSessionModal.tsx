import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Problem, RecallResultType, ReviewSubmissionResult } from '../../types';
import { submitReview } from '../../api/reviews.api';
import { DifficultyBadge } from '../problems/DifficultyBadge';
import { RetentionBadge } from '../problems/RetentionBadge';
import { RecallResultBadge } from './RecallResultBadge';
import { SrsProgressionStepper } from './SrsProgressionStepper';
import { Alert } from '../ui/Alert';
import { Badge, BadgeTone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { cx } from '../ui/cx';
import { useElapsedTimer } from '../../hooks/useElapsedTimer';
import { formatTiming, formatCalendarDate } from '../../utils/date.utils';
import { getErrorMessage } from '../../utils/error.utils';
import { getSafeUrl } from '../../utils/url.util';
import styles from './RecallSessionModal.module.css';

interface RecallSessionModalProps {
  isOpen: boolean;
  problem: Problem | null;
  onClose: () => void;
  onSuccess: (result: ReviewSubmissionResult) => void;
}

type ModalStep = 'ATTEMPT' | 'EVALUATE' | 'RESULT';

/**
 * DSA Tracker — Recall session (Phase 8)
 * ======================================
 * The three-step recall workflow (attempt → evaluate → result), unchanged in
 * behaviour and now hosted by the shared `Dialog` primitive.
 *
 * Semantics preserved exactly:
 *   - the same `POST /reviews` payload (`problemId`, `recallResult`,
 *     `timeSpentSeconds`, `coldSolve`) submitted on the same four recall choices;
 *   - the same step machine and the same reset when a new problem opens;
 *   - the same elapsed-time semantics: the timer runs only during `ATTEMPT`, pauses when
 *     the attempt is finished, and the measured seconds are the ones submitted. The
 *     measurement itself is timestamp-based (`useElapsedTimer`) rather than a per-tick
 *     counter, so background tabs and late ticks cannot make it run slow;
 *   - `onSuccess(result)` still fires as soon as the API responds, and a failed submit
 *     still stays on `EVALUATE` with the message and re-enables the choices.
 *
 * What the redesign adds is accessibility that the hand-rolled overlay never had:
 *   - `role="dialog"` + `aria-modal` + `aria-labelledby`, rendered in a portal;
 *   - focus moves into the dialog, is trapped while it is open, and returns to the
 *     "Start Revision" button that opened it;
 *   - Escape closes it and the page behind it cannot scroll;
 *   - below 640px the panel becomes a bottom sheet;
 *   - the error banner is an `Alert` (`role="alert"`) and the ticking timer is a
 *     `role="timer"` with a label — deliberately not a live region, so a screen reader
 *     is not interrupted every second.
 */

const RECALL_OPTIONS: ReadonlyArray<{ value: RecallResultType; description: string }> = [
  { value: 'EASY', description: 'Solved smoothly and independently with optimal complexity.' },
  { value: 'STRUGGLED', description: 'Solved with effort, required edge-case fixes or extra time.' },
  { value: 'HINT', description: 'Needed a nudge, invariant lookup, or hint to complete.' },
  {
    value: 'FORGOT',
    description: 'Could not recall approach; enters short-term recovery sequence.',
  },
];

const RECALL_CARD_CLASS: Record<RecallResultType, string> = {
  EASY: styles.recallEasy,
  STRUGGLED: styles.recallStruggled,
  HINT: styles.recallHint,
  FORGOT: styles.recallForgot,
};

export const RecallSessionModal: React.FC<RecallSessionModalProps> = ({
  isOpen,
  problem,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<ModalStep>('ATTEMPT');
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [isColdSolve, setIsColdSolve] = useState(true);
  const [isNotesRevealed, setIsNotesRevealed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<ReviewSubmissionResult | null>(null);

  /**
   * Elapsed time comes from `performance.now()` deltas, not from counting interval ticks.
   * It advances only while the attempt is in progress; finishing the attempt pauses it and
   * the accumulated value is what the review submits. A new session resets it to zero.
   */
  const { elapsedSeconds } = useElapsedTimer({
    active: isOpen && Boolean(problem) && isTimerRunning && step === 'ATTEMPT',
    resetKey: `${problem?.id ?? 'none'}:${isOpen ? 'open' : 'closed'}`,
  });

  useEffect(() => {
    if (isOpen && problem) {
      setStep('ATTEMPT');
      setIsTimerRunning(true);
      setIsColdSolve(true);
      setIsNotesRevealed(false);
      setErrorMessage(null);
      setSubmissionResult(null);
    }
  }, [isOpen, problem]);

  if (!isOpen || !problem) return null;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleFinishAttempt = () => {
    setIsTimerRunning(false);
    setStep('EVALUATE');
  };

  const handleSelectRecall = async (recallResult: RecallResultType) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await submitReview({
        problemId: problem.id,
        recallResult,
        timeSpentSeconds: elapsedSeconds,
        coldSolve: isColdSolve,
      });

      setSubmissionResult(result);
      setStep('RESULT');
      onSuccess(result);
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, 'Failed to record revision. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const collegeUrl = getSafeUrl(problem.collegeLink);
  const leetcodeUrl = getSafeUrl(problem.leetcodeLink);

  const timingTone: BadgeTone =
    submissionResult?.transition.timingStatus === 'LATE'
      ? 'danger'
      : submissionResult?.transition.timingStatus === 'EARLY'
        ? 'info'
        : 'success';

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      size="lg"
      title={problem.title}
      description={
        <span className={styles.sectionTag}>
          {problem.section} DSA #{problem.sNo}
          {problem.leetcodeNumber ? ` · LC #${problem.leetcodeNumber}` : ''}
        </span>
      }
    >
      <div className={styles.content}>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

        <div className={styles.metaRow}>
          <DifficultyBadge difficulty={problem.difficulty} />
          <RetentionBadge retention={problem.retentionLevel} />
          <span className={styles.topicChip}>{problem.topic}</span>

          <div className={styles.linkGroup}>
            {collegeUrl && (
              <a
                href={collegeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                <span>College</span>
                <ExternalLink size={12} aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
            {leetcodeUrl && (
              <a
                href={leetcodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                <span>LeetCode</span>
                <ExternalLink size={12} aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>

        <div className={styles.stepperWrap}>
          <SrsProgressionStepper
            repetitionStage={problem.repetitionStage ?? 0}
            intervalDays={problem.intervalDays ?? 0}
            nextReviewDate={problem.nextReviewDate}
            lastReviewedAt={problem.lastReviewedAt}
            retentionLevel={problem.retentionLevel}
            compact={true}
          />
        </div>

        {step === 'ATTEMPT' && (
          <section className={styles.attemptBox} aria-label="Cold solve attempt">
            <p
              className={styles.timer}
              role="timer"
              aria-label={`Elapsed time ${formatTimer(elapsedSeconds)}`}
            >
              <span aria-hidden="true">{formatTimer(elapsedSeconds)}</span>
            </p>

            <p className={styles.instruction}>
              Solve this problem cold on external editor or whiteboard. Invariants and solution
              notes remain hidden during your attempt.
            </p>

            <div className={styles.coldSolve}>
              <input
                id="recall-cold-solve"
                type="checkbox"
                className={styles.checkbox}
                checked={isColdSolve}
                onChange={(e) => setIsColdSolve(e.target.checked)}
              />
              <label htmlFor="recall-cold-solve" className={styles.coldSolveLabel}>
                Cold solve attempt (no prior solution check)
              </label>
            </div>

            <Button
              size="lg"
              fullWidth
              iconLeft={<CheckCircle2 size={18} aria-hidden="true" />}
              onClick={handleFinishAttempt}
            >
              I&apos;ve Finished My Attempt
            </Button>
          </section>
        )}

        {step === 'EVALUATE' && (
          <div className={styles.evaluate}>
            <div className={styles.evaluateHeader}>
              <h3 className={styles.evaluateTitle}>Evaluate your recall quality:</h3>
              <Button
                variant="secondary"
                size="sm"
                aria-expanded={isNotesRevealed}
                iconLeft={
                  isNotesRevealed ? (
                    <EyeOff size={14} aria-hidden="true" />
                  ) : (
                    <Eye size={14} aria-hidden="true" />
                  )
                }
                onClick={() => setIsNotesRevealed((prev) => !prev)}
              >
                {isNotesRevealed ? 'Hide Notes' : 'Reveal Solution Notes'}
              </Button>
            </div>

            {isNotesRevealed && (
              <div className={styles.notesBox}>
                {problem.notes && problem.notes.trim() ? (
                  problem.notes
                ) : (
                  <span className={styles.notesEmpty}>No notes recorded for this problem.</span>
                )}
              </div>
            )}

            {isSubmitting ? (
              <div className={styles.submitting} role="status" aria-busy="true">
                <span className="sr-only">Saving revision and calculating the next schedule</span>
                <Loader2 size={28} className={styles.spinner} aria-hidden="true" />
                <p aria-hidden="true">Calculating next spaced repetition schedule...</p>
              </div>
            ) : (
              <div className={styles.recallGrid} role="group" aria-label="Recall quality">
                {RECALL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cx(styles.recallCard, RECALL_CARD_CLASS[option.value])}
                    onClick={() => handleSelectRecall(option.value)}
                  >
                    <span className={styles.recallTitle}>{option.value}</span>
                    <span className={styles.recallDesc}>{option.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'RESULT' && submissionResult && (
          <div className={styles.result} role="status">
            <div className={styles.resultHeader}>
              <span className={styles.resultIcon} aria-hidden="true">
                <Sparkles size={22} />
              </span>
              <h3 className={styles.resultTitle}>Revision Recorded!</h3>
              <div className={styles.resultBadges}>
                <RecallResultBadge result={submissionResult.history.recallResult} />
                <Badge tone={timingTone} shape="compact" dot>
                  {formatTiming(
                    submissionResult.transition.timingStatus,
                    submissionResult.transition.latenessDays
                  )}
                </Badge>
              </div>
            </div>

            <dl className={styles.resultGrid}>
              <div className={styles.resultItem}>
                <dt className={styles.resultLabel}>Stage Progression</dt>
                <dd className={styles.resultValue}>
                  <span>
                    Stage {submissionResult.transition.previousStage} (
                    {submissionResult.transition.previousIntervalDays}d)
                  </span>
                  <ArrowRight size={14} aria-hidden="true" />
                  <span className={styles.resultValueAccent}>
                    Stage {submissionResult.transition.newStage} (
                    {submissionResult.transition.newIntervalDays}d)
                  </span>
                </dd>
              </div>

              <div className={styles.resultItem}>
                <dt className={styles.resultLabel}>Next Review Date</dt>
                <dd className={cx(styles.resultValue, styles.resultValueAccent)}>
                  {formatCalendarDate(submissionResult.transition.nextReviewDate)}
                </dd>
              </div>

              <div className={styles.resultItem}>
                <dt className={styles.resultLabel}>Retention Level</dt>
                <dd className={styles.resultValue}>
                  {submissionResult.transition.previousRetention} →{' '}
                  {submissionResult.transition.newRetention}
                </dd>
              </div>

              <div className={styles.resultItem}>
                <dt className={styles.resultLabel}>Time Spent</dt>
                <dd className={styles.resultValue}>{formatTimer(elapsedSeconds)}</dd>
              </div>
            </dl>

            <Button size="lg" fullWidth onClick={onClose}>
              Back to Due Queue
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
