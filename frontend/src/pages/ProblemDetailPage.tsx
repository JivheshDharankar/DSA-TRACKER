import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Edit2,
  Trash2,
  FileText,
  Loader2,
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
import {
  Problem,
  UpdateProblemInput,
  RevisionHistoryItem,
  ProblemPatternAttachment,
  PatternConfidence,
  ProblemMasteryDetails,
} from '../types';
import { DifficultyBadge } from '../components/problems/DifficultyBadge';
import { RetentionBadge } from '../components/problems/RetentionBadge';
import { StatusBadge } from '../components/problems/StatusBadge';
import { MasteryBadge } from '../components/problems/MasteryBadge';
import { ProblemModal } from '../components/problems/ProblemModal';
import { DeleteProblemDialog } from '../components/problems/DeleteProblemDialog';
import { RevisionHistoryList } from '../components/reviews/RevisionHistoryList';
import { SrsProgressionStepper } from '../components/reviews/SrsProgressionStepper';
import { PatternPickerModal } from '../components/patterns/PatternPickerModal';
import { formatCalendarDate } from '../utils/date.utils';
import styles from '../styles/ProblemDetail.module.css';

export const ProblemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [history, setHistory] = useState<RevisionHistoryItem[]>([]);
  const [patterns, setPatterns] = useState<ProblemPatternAttachment[]>([]);
  const [mastery, setMastery] = useState<ProblemMasteryDetails | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      const data = await fetchProblemById(id);
      setProblem(data);
      loadHistory();
      loadPatterns();
      loadMastery();
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'Problem not found or access denied.');
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

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
        <Loader2 size={36} color="var(--accent-cyan)" className="animate-spin" />
        <span style={{ color: 'var(--text-muted)' }}>Loading problem details...</span>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center', padding: '32px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
        <AlertCircle size={36} color="var(--color-hard)" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>Problem Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
          {error || 'This problem does not exist or you do not have permission to view it.'}
        </p>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: 'var(--accent-cyan)',
            color: 'var(--text-inverse)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  const backUrl = problem.section === 'PERSONAL' ? '/personal-dsa' : '/college-dsa';

  return (
    <div className={styles.detailContainer}>
      <div className={styles.topBar}>
        <Link to={backUrl} className={styles.backBtn}>
          <ArrowLeft size={16} />
          <span>Back to {problem.section === 'PERSONAL' ? 'Personal DSA' : 'College DSA'}</span>
        </Link>

        <div className={styles.actionButtons}>
          <button onClick={() => setIsEditModalOpen(true)} className={styles.editBtn}>
            <Edit2 size={15} />
            <span>Edit Problem</span>
          </button>
          <button onClick={() => setIsDeleteDialogOpen(true)} className={styles.deleteBtn}>
            <Trash2 size={15} />
            <span>Delete Problem</span>
          </button>
        </div>
      </div>

      <div className={styles.mainCard}>
        <div className={styles.titleArea}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-xs)', flexWrap: 'wrap' }}>
              <span className={styles.sNoTag}>
                {problem.section} DSA #{problem.sNo}
              </span>
              <MasteryBadge status={problem.masteryStatus} />
            </div>
            <h2 className={styles.title}>{problem.title}</h2>
          </div>

          {(problem.collegeLink || problem.leetcodeLink) && (
            <div className={styles.linkGroup}>
              {problem.collegeLink && (
                <a
                  href={problem.collegeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.linkBtn} ${styles.collegeLinkBtn}`}
                  title="Open College Problem Link"
                >
                  <ExternalLink size={14} />
                  <span>College Link ↗</span>
                </a>
              )}
              {problem.leetcodeLink && (
                <a
                  href={problem.leetcodeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.linkBtn} ${styles.leetcodeLinkBtn}`}
                  title="Open LeetCode Problem Link"
                >
                  <ExternalLink size={14} />
                  <span>LeetCode Link ↗</span>
                </a>
              )}
            </div>
          )}
        </div>

        <div className={styles.grid}>
          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Topic</span>
            <span className={styles.gridValue}>{problem.topic}</span>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Difficulty</span>
            <div>
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Source</span>
            <span className={styles.gridValue}>{problem.source}</span>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>LeetCode #</span>
            <span className={styles.gridValue}>
              {problem.leetcodeNumber ? `#${problem.leetcodeNumber}` : '—'}
            </span>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Status</span>
            <div>
              <StatusBadge status={problem.status} />
            </div>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Retention Level</span>
            <div>
              <RetentionBadge retention={problem.retentionLevel} />
            </div>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Mastery Status</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <MasteryBadge status={problem.masteryStatus} />
              {problem.lockedAt && (
                <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
                  Locked {formatCalendarDate(problem.lockedAt)} (v{problem.lockVersion})
                </span>
              )}
            </div>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Date Learned</span>
            <span className={styles.gridValue}>
              {new Date(problem.dateLearned).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Stage & Interval</span>
            <span className={styles.gridValue} style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              Stage {problem.repetitionStage ?? 0} ({problem.intervalDays ?? 0}d)
            </span>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Next Review</span>
            <span className={styles.gridValue} style={{ color: 'var(--color-easy)' }}>
              {formatCalendarDate(problem.nextReviewDate)}
            </span>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Last Reviewed</span>
            <span className={styles.gridValue}>
              {problem.lastReviewedAt ? formatCalendarDate(problem.lastReviewedAt) : 'Never'}
            </span>
          </div>

          <div className={styles.gridItem}>
            <span className={styles.gridLabel}>Created</span>
            <span className={styles.gridValue} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {new Date(problem.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Spaced Repetition Progression Stepper & Timeline */}
        <div style={{ marginTop: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
          <SrsProgressionStepper
            repetitionStage={problem.repetitionStage ?? 0}
            intervalDays={problem.intervalDays ?? 0}
            nextReviewDate={problem.nextReviewDate}
            lastReviewedAt={problem.lastReviewedAt}
            retentionLevel={problem.retentionLevel}
            history={history}
          />
        </div>

        {/* Phase 8: Locked Mastery & 4-Gate Qualification Panel */}
        <div className={styles.masterySection}>
          <div className={`${styles.masteryCard} ${mastery?.masteryStatus === 'LOCKED' ? styles.masteryCardLocked : ''}`}>
            <div className={styles.masteryTopRow}>
              <div className={styles.masteryHeading}>
                <ShieldCheck size={20} color={mastery?.masteryStatus === 'LOCKED' ? '#fbbf24' : 'var(--accent-cyan)'} />
                <span>Proof-of-Learning Mastery & Qualification</span>
                {mastery && <MasteryBadge status={mastery.masteryStatus} />}
              </div>
            </div>

            {mastery && (
              <>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {mastery.masteryStatus === 'LOCKED' ? (
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                      ★ Problem is LOCKED in mastery. Locked on {mastery.lockedAt ? new Date(mastery.lockedAt).toLocaleString() : 'N/A'}. (Lock version: v{mastery.lockVersion})
                    </span>
                  ) : mastery.isEligible ? (
                    <span style={{ color: '#34d399', fontWeight: 600 }}>
                      ✓ All 4 qualification gates are satisfied! Problem qualifies for Locked mastery status.
                    </span>
                  ) : (
                    <span>
                      Requires passing all 4 evidence-based learning gates simultaneously to achieve Locked status.
                    </span>
                  )}
                </div>

                <div className={styles.gatesGrid}>
                  {/* Gate A */}
                  <div className={`${styles.gateItem} ${mastery.gates.solved.passed ? styles.gatePassed : styles.gateFailed}`}>
                    {mastery.gates.solved.passed ? (
                      <CheckCircle2 size={18} className={styles.gateIconPass} />
                    ) : (
                      <XCircle size={18} className={styles.gateIconFail} />
                    )}
                    <div className={styles.gateContent}>
                      <span className={styles.gateTitle}>Gate A: Solved Status</span>
                      <span className={styles.gateSubtitle}>
                        Status: {mastery.gates.solved.status} (Required: Solved)
                      </span>
                    </div>
                  </div>

                  {/* Gate B */}
                  <div className={`${styles.gateItem} ${mastery.gates.srsEvidence.passed ? styles.gatePassed : styles.gateFailed}`}>
                    {mastery.gates.srsEvidence.passed ? (
                      <CheckCircle2 size={18} className={styles.gateIconPass} />
                    ) : (
                      <XCircle size={18} className={styles.gateIconFail} />
                    )}
                    <div className={styles.gateContent}>
                      <span className={styles.gateTitle}>Gate B: Spaced Reviews</span>
                      <span className={styles.gateSubtitle}>
                        {mastery.gates.srsEvidence.successfulReviewsCount}/{mastery.gates.srsEvidence.requiredReviewsCount} successes &bull; Stage &ge;3: {mastery.gates.srsEvidence.hasStageThreeMilestone ? 'Yes' : 'No'} (Max: {mastery.gates.srsEvidence.maxStageReached})
                      </span>
                    </div>
                  </div>

                  {/* Gate C */}
                  <div className={`${styles.gateItem} ${mastery.gates.coldRecall.passed ? styles.gatePassed : styles.gateFailed}`}>
                    {mastery.gates.coldRecall.passed ? (
                      <CheckCircle2 size={18} className={styles.gateIconPass} />
                    ) : (
                      <XCircle size={18} className={styles.gateIconFail} />
                    )}
                    <div className={styles.gateContent}>
                      <span className={styles.gateTitle}>Gate C: Cold Solves</span>
                      <span className={styles.gateSubtitle}>
                        {mastery.gates.coldRecall.qualifyingColdSolvesCount}/{mastery.gates.coldRecall.requiredColdSolvesCount} successful cold solves
                      </span>
                    </div>
                  </div>

                  {/* Gate D */}
                  <div className={`${styles.gateItem} ${mastery.gates.recentSuccess.passed ? styles.gatePassed : styles.gateFailed}`}>
                    {mastery.gates.recentSuccess.passed ? (
                      <CheckCircle2 size={18} className={styles.gateIconPass} />
                    ) : (
                      <XCircle size={18} className={styles.gateIconFail} />
                    )}
                    <div className={styles.gateContent}>
                      <span className={styles.gateTitle}>Gate D: Recent Review</span>
                      <span className={styles.gateSubtitle}>
                        Latest: {mastery.gates.recentSuccess.latestOutcome ? `${mastery.gates.recentSuccess.latestOutcome}` : 'No reviews'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Algorithmic Patterns Section */}
        <div className={styles.patternsSection}>
          <div className={styles.patternsHeader}>
            <div className={styles.patternsHeading}>
              <Layers size={18} color="var(--accent-cyan)" />
              <span>Algorithmic Patterns ({patterns.length})</span>
            </div>
            <button
              className={styles.managePatternsBtn}
              onClick={() => setIsPatternModalOpen(true)}
            >
              <Sparkles size={14} />
              <span>Manage Patterns</span>
            </button>
          </div>

          {patterns.length > 0 ? (
            <div className={styles.patternPillsContainer}>
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
                    <span
                      className={`${styles.confidenceTag} ${
                        att.confidence === 'HIGH'
                          ? styles.confidenceTagHigh
                          : att.confidence === 'MEDIUM'
                          ? styles.confidenceTagMedium
                          : styles.confidenceTagLow
                      }`}
                    >
                      {att.confidence}
                    </span>
                    {att.isPrimary && <span className={styles.primaryBadge}>Primary</span>}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No algorithmic patterns tagged yet.{' '}
              <button
                onClick={() => setIsPatternModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  font: 'inherit',
                }}
              >
                Assign patterns
              </button>{' '}
              to track pattern recognition and transfer mastery.
            </div>
          )}
        </div>

        {/* Notes & Invariants */}
        <div className={styles.notesSection}>
          <div className={styles.notesHeading}>
            <FileText size={18} color="var(--accent-cyan)" />
            <span>Approach, Invariants & Notes</span>
          </div>
          <div className={styles.notesBox}>
            {problem.notes && problem.notes.trim() ? (
              problem.notes
            ) : (
              <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                No notes or invariants recorded for this problem yet. Click Edit to document your solution approach.
              </span>
            )}
          </div>
        </div>

        {/* Revision History */}
        <div className={styles.historySection}>
          <div className={styles.historyHeading}>
            <History size={18} color="var(--accent-cyan)" />
            <span>Revision History ({history.length})</span>
          </div>
          <RevisionHistoryList history={history} isLoading={isHistoryLoading} />
        </div>
      </div>

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

