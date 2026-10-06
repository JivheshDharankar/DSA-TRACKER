import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Problem, RecallResultType, ReviewSubmissionResult } from '../../types';
import { submitReview } from '../../api/reviews.api';
import { DifficultyBadge } from '../problems/DifficultyBadge';
import { RetentionBadge } from '../problems/RetentionBadge';
import { RecallResultBadge } from './RecallResultBadge';
import { SrsProgressionStepper } from './SrsProgressionStepper';
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

export const RecallSessionModal: React.FC<RecallSessionModalProps> = ({
  isOpen,
  problem,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<ModalStep>('ATTEMPT');
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [isColdSolve, setIsColdSolve] = useState(true);
  const [isNotesRevealed, setIsNotesRevealed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<ReviewSubmissionResult | null>(null);

  useEffect(() => {
    if (isOpen && problem) {
      setStep('ATTEMPT');
      setSecondsElapsed(0);
      setIsTimerRunning(true);
      setIsColdSolve(true);
      setIsNotesRevealed(false);
      setErrorMessage(null);
      setSubmissionResult(null);
    }
  }, [isOpen, problem]);

  // Elapsed timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isOpen && isTimerRunning && step === 'ATTEMPT') {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, isTimerRunning, step]);

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
        timeSpentSeconds: secondsElapsed,
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

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.sNoBadge}>
              {problem.section} DSA #{problem.sNo}
              {problem.leetcodeNumber ? ` · LC #${problem.leetcodeNumber}` : ''}
            </span>
            <h3 className={styles.title}>{problem.title}</h3>
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: '#f87171',
                fontSize: '0.85rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className={styles.metaRow}>
            <DifficultyBadge difficulty={problem.difficulty} />
            <RetentionBadge retention={problem.retentionLevel} />
            <span
              style={{
                fontSize: '0.75rem',
                background: 'var(--bg-surface-elevated)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
              }}
            >
              {problem.topic}
            </span>

            <div className={styles.linkGroup} style={{ marginLeft: 'auto' }}>
              {getSafeUrl(problem.collegeLink) && (
                <a
                  href={getSafeUrl(problem.collegeLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.linkBtn} ${styles.collegeLink}`}
                >
                  <span>College</span>
                  <ExternalLink size={12} />
                </a>
              )}
              {getSafeUrl(problem.leetcodeLink) && (
                <a
                  href={getSafeUrl(problem.leetcodeLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.linkBtn} ${styles.leetcodeLink}`}
                >
                  <span>LeetCode</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>

          <div style={{ margin: '4px 0 12px 0' }}>
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
            <div className={styles.instructionBox}>
              <div className={styles.timer}>{formatTimer(secondsElapsed)}</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px' }}>
                Solve this problem cold on external editor or whiteboard. Invariants and solution
                notes remain hidden during your attempt.
              </p>

              <label className={styles.coldSolveLabel}>
                <input
                  type="checkbox"
                  checked={isColdSolve}
                  onChange={(e) => setIsColdSolve(e.target.checked)}
                />
                <span>Cold solve attempt (no prior solution check)</span>
              </label>

              <button onClick={handleFinishAttempt} className={styles.finishBtn}>
                <CheckCircle2 size={18} />
                <span>I've Finished My Attempt</span>
              </button>
            </div>
          )}

          {step === 'EVALUATE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Evaluate your recall quality:
                </span>
                <button
                  type="button"
                  onClick={() => setIsNotesRevealed((prev) => !prev)}
                  className={styles.notesToggleBtn}
                >
                  {isNotesRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{isNotesRevealed ? 'Hide Notes' : 'Reveal Solution Notes'}</span>
                </button>
              </div>

              {isNotesRevealed && (
                <div className={styles.notesBox}>
                  {problem.notes && problem.notes.trim() ? (
                    problem.notes
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      No notes recorded for this problem.
                    </span>
                  )}
                </div>
              )}

              {isSubmitting ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px',
                    gap: '12px',
                  }}
                >
                  <Loader2 size={32} className="animate-spin" color="var(--accent-cyan)" />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Calculating next spaced repetition schedule...
                  </span>
                </div>
              ) : (
                <div className={styles.recallGrid}>
                  <button
                    onClick={() => handleSelectRecall('EASY')}
                    className={`${styles.recallCard} ${styles.recallCardEasy}`}
                  >
                    <span className={styles.recallTitle} style={{ color: 'var(--color-easy)' }}>
                      EASY
                    </span>
                    <span className={styles.recallDesc}>
                      Solved smoothly and independently with optimal complexity.
                    </span>
                  </button>

                  <button
                    onClick={() => handleSelectRecall('STRUGGLED')}
                    className={`${styles.recallCard} ${styles.recallCardStruggled}`}
                  >
                    <span className={styles.recallTitle} style={{ color: 'var(--color-medium)' }}>
                      STRUGGLED
                    </span>
                    <span className={styles.recallDesc}>
                      Solved with effort, required edge-case fixes or extra time.
                    </span>
                  </button>

                  <button
                    onClick={() => handleSelectRecall('HINT')}
                    className={`${styles.recallCard} ${styles.recallCardHint}`}
                  >
                    <span className={styles.recallTitle} style={{ color: 'var(--accent-cyan)' }}>
                      HINT
                    </span>
                    <span className={styles.recallDesc}>
                      Needed a nudge, invariant lookup, or hint to complete.
                    </span>
                  </button>

                  <button
                    onClick={() => handleSelectRecall('FORGOT')}
                    className={`${styles.recallCard} ${styles.recallCardForgot}`}
                  >
                    <span className={styles.recallTitle} style={{ color: 'var(--color-hard)' }}>
                      FORGOT
                    </span>
                    <span className={styles.recallDesc}>
                      Could not recall approach; enters short-term recovery sequence.
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'RESULT' && submissionResult && (
            <div className={styles.resultContainer}>
              <div className={styles.resultHeader}>
                <Sparkles size={28} color="var(--accent-cyan)" />
                <h4 style={{ color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 700 }}>
                  Revision Recorded!
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <RecallResultBadge result={submissionResult.history.recallResult} />
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color:
                        submissionResult.transition.timingStatus === 'LATE'
                          ? 'var(--color-hard)'
                          : 'var(--color-easy)',
                    }}
                  >
                    {formatTiming(
                      submissionResult.transition.timingStatus,
                      submissionResult.transition.latenessDays
                    )}
                  </span>
                </div>
              </div>

              <div className={styles.resultGrid}>
                <div className={styles.resultItem}>
                  <span className={styles.resultLabel}>Stage Progression</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={styles.resultValue}>
                      Stage {submissionResult.transition.previousStage} (
                      {submissionResult.transition.previousIntervalDays}d)
                    </span>
                    <ArrowRight size={14} color="var(--accent-cyan)" />
                    <span className={styles.resultValue} style={{ color: 'var(--accent-cyan)' }}>
                      Stage {submissionResult.transition.newStage} (
                      {submissionResult.transition.newIntervalDays}d)
                    </span>
                  </div>
                </div>

                <div className={styles.resultItem}>
                  <span className={styles.resultLabel}>Next Review Date</span>
                  <span className={styles.resultValue} style={{ color: 'var(--color-easy)' }}>
                    {formatCalendarDate(submissionResult.transition.nextReviewDate)}
                  </span>
                </div>

                <div className={styles.resultItem}>
                  <span className={styles.resultLabel}>Retention Level</span>
                  <span className={styles.resultValue}>
                    {submissionResult.transition.previousRetention} →{' '}
                    {submissionResult.transition.newRetention}
                  </span>
                </div>

                <div className={styles.resultItem}>
                  <span className={styles.resultLabel}>Time Spent</span>
                  <span className={styles.resultValue}>{formatTimer(secondsElapsed)}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className={styles.finishBtn}
                style={{ marginTop: 'var(--space-md)' }}
              >
                <span>Back to Due Queue</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
