import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Bookmark } from 'lucide-react';
import {
  Problem,
  SectionType,
  DifficultyType,
  StatusType,
  RetentionType,
  COLLEGE_SOURCES,
  PERSONAL_SOURCES,
  CreateProblemInput,
  UpdateProblemInput,
  PatternWithMastery,
} from '../../types';
import { fetchPatterns, fetchProblemPatterns, syncProblemPatterns } from '../../api/patterns.api';
import { getErrorMessage } from '../../utils/error.utils';
import { toInputDateString } from '../../utils/date.utils';
import { getSafeUrl } from '../../utils/url.util';
import styles from './ProblemModal.module.css';

interface ProblemModalProps {
  isOpen: boolean;
  section: SectionType;
  problemToEdit?: Problem | null;
  onClose: () => void;
  onSubmitCreate: (data: CreateProblemInput) => Promise<Problem | void>;
  onSubmitUpdate: (id: string, data: UpdateProblemInput) => Promise<void>;
}

export const ProblemModal: React.FC<ProblemModalProps> = ({
  isOpen,
  section,
  problemToEdit,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
}) => {
  const isEditMode = Boolean(problemToEdit);

  const [title, setTitle] = useState('');
  const [collegeLink, setCollegeLink] = useState('');
  const [leetcodeLink, setLeetcodeLink] = useState('');
  const [leetcodeNumber, setLeetcodeNumber] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [selectedPatternId, setSelectedPatternId] = useState<string>('');
  const [availablePatterns, setAvailablePatterns] = useState<PatternWithMastery[]>([]);
  const [difficulty, setDifficulty] = useState<DifficultyType>('Easy');
  const [source, setSource] = useState<string>('');
  const [dateLearned, setDateLearned] = useState<string>(toInputDateString());
  const [status, setStatus] = useState<StatusType>('Not Started');
  const [retentionLevel, setRetentionLevel] = useState<RetentionType>('Learning');
  const [notes, setNotes] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load available patterns catalog
  useEffect(() => {
    if (isOpen) {
      fetchPatterns()
        .then((pats) => setAvailablePatterns(pats))
        .catch((err) => console.error('Failed to load patterns list:', err));
    }
  }, [isOpen]);

  // Populate fields on edit or reset on new
  useEffect(() => {
    if (problemToEdit) {
      setTitle(problemToEdit.title);
      setCollegeLink(problemToEdit.collegeLink || '');
      setLeetcodeLink(problemToEdit.leetcodeLink || '');
      setLeetcodeNumber(problemToEdit.leetcodeNumber ? String(problemToEdit.leetcodeNumber) : '');
      setTopic(problemToEdit.topic);
      setDifficulty(problemToEdit.difficulty);
      setSource(problemToEdit.source);
      setDateLearned(toInputDateString(problemToEdit.dateLearned));
      setStatus(problemToEdit.status);
      setRetentionLevel(problemToEdit.retentionLevel);
      setNotes(problemToEdit.notes || '');

      // Fetch attached pattern if editing
      fetchProblemPatterns(problemToEdit.id)
        .then((attached) => {
          const primary = attached.find((a) => a.isPrimary) || attached[0];
          if (primary) {
            setSelectedPatternId(primary.pattern.id);
          } else {
            setSelectedPatternId('');
          }
        })
        .catch(() => setSelectedPatternId(''));
    } else {
      setTitle('');
      setCollegeLink('');
      setLeetcodeLink('');
      setLeetcodeNumber('');
      setTopic('');
      setSelectedPatternId('');
      setDifficulty('Easy');
      setSource(section === 'COLLEGE' ? 'Lecture' : 'LeetCode');
      setDateLearned(toInputDateString());
      setStatus('Not Started');
      setRetentionLevel('Learning');
      setNotes('');
    }
    setErrorMessage(null);
  }, [problemToEdit, section, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Problem title is required.');
      return;
    }

    if (collegeLink.trim() && !collegeLink.trim().match(/^https?:\/\//i)) {
      setErrorMessage('College link must be a valid URL starting with http:// or https://');
      return;
    }

    if (leetcodeLink.trim() && !leetcodeLink.trim().match(/^https?:\/\//i)) {
      setErrorMessage('LeetCode link must be a valid URL starting with http:// or https://');
      return;
    }

    if (!topic.trim()) {
      setErrorMessage('Topic is required (e.g., Arrays, Dynamic Programming).');
      return;
    }

    const parsedLcNumber = leetcodeNumber.trim() ? parseInt(leetcodeNumber.trim(), 10) : null;
    const parsedCollegeLink = collegeLink.trim() ? collegeLink.trim() : null;
    const parsedLeetcodeLink = leetcodeLink.trim() ? leetcodeLink.trim() : null;

    setIsSubmitting(true);
    try {
      if (isEditMode && problemToEdit) {
        await onSubmitUpdate(problemToEdit.id, {
          title: title.trim(),
          collegeLink: parsedCollegeLink,
          leetcodeLink: parsedLeetcodeLink,
          leetcodeNumber: parsedLcNumber,
          topic: topic.trim(),
          difficulty,
          source: source.trim() || (section === 'COLLEGE' ? 'Lecture' : 'LeetCode'),
          dateLearned: new Date(dateLearned).toISOString(),
          status,
          retentionLevel,
          notes: notes.trim(),
        });

        // Sync attached pattern if changed
        if (selectedPatternId) {
          await syncProblemPatterns(problemToEdit.id, [
            { patternId: selectedPatternId, confidence: 'HIGH', isPrimary: true },
          ]);
        }
      } else {
        const created = await onSubmitCreate({
          section,
          title: title.trim(),
          collegeLink: parsedCollegeLink,
          leetcodeLink: parsedLeetcodeLink,
          leetcodeNumber: parsedLcNumber,
          topic: topic.trim(),
          difficulty,
          source: source.trim() || (section === 'COLLEGE' ? 'Lecture' : 'LeetCode'),
          dateLearned: new Date(dateLearned).toISOString(),
          status,
          retentionLevel,
          notes: notes.trim(),
        });

        // Attach pattern if selected and problem ID returned
        if (created && created.id && selectedPatternId) {
          try {
            await syncProblemPatterns(created.id, [
              { patternId: selectedPatternId, confidence: 'HIGH', isPrimary: true },
            ]);
          } catch (err) {
            console.error('Failed to attach pattern after problem creation:', err);
          }
        }
      }
      onClose();
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, 'Operation failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSources = section === 'COLLEGE' ? COLLEGE_SOURCES : PERSONAL_SOURCES;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bookmark size={18} color="var(--accent-cyan)" />
            <h3 className={styles.title}>
              {isEditMode
                ? `Edit Problem #${problemToEdit?.sNo}`
                : `Add ${section === 'COLLEGE' ? 'College' : 'Personal'} DSA Problem`}
            </h3>
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {errorMessage && (
            <div className={styles.errorBanner}>
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* S.No. Info & Section Display */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              color: 'var(--text-dim)',
            }}
          >
            <span>
              Section: <strong style={{ color: 'var(--text-main)' }}>{section} DSA</strong>
            </span>
            <span>
              S.No:{' '}
              <strong style={{ color: 'var(--accent-cyan)' }}>
                {isEditMode ? `#${problemToEdit?.sNo}` : 'Auto-generated on save'}
              </strong>
            </span>
          </div>

          {/* Problem Title */}
          <div className={styles.field}>
            <label className={styles.label}>Problem Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Longest Substring Without Repeating Characters"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Topic and Primary Pattern */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Topic *</label>
              <input
                type="text"
                required
                placeholder="e.g. Arrays, Strings, Trees, DP"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="primary-pattern-select" className={styles.label}>
                Primary Pattern (Optional)
              </label>
              <select
                id="primary-pattern-select"
                aria-label="Primary Pattern (Optional)"
                value={selectedPatternId}
                onChange={(e) => setSelectedPatternId(e.target.value)}
                className={styles.select}
              >
                <option value="">None / Unspecified</option>
                {availablePatterns.map((pat) => (
                  <option key={pat.id} value={pat.id}>
                    {pat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dual Links Configuration */}
          {section === 'PERSONAL' ? (
            <>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    LeetCode Link (Optional)
                    {getSafeUrl(leetcodeLink) && (
                      <a
                        href={getSafeUrl(leetcodeLink)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginLeft: '8px', color: 'var(--accent-cyan)', fontSize: '0.75rem' }}
                      >
                        Open ↗
                      </a>
                    )}
                  </label>
                  <input
                    type="url"
                    placeholder="https://leetcode.com/problems/..."
                    value={leetcodeLink}
                    onChange={(e) => setLeetcodeLink(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>LeetCode Number (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 3"
                    value={leetcodeNumber}
                    onChange={(e) => setLeetcodeNumber(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  College Link (Optional Dual Link)
                  {getSafeUrl(collegeLink) && (
                    <a
                      href={getSafeUrl(collegeLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: '8px', color: 'var(--accent-cyan)', fontSize: '0.75rem' }}
                    >
                      Open ↗
                    </a>
                  )}
                </label>
                <input
                  type="url"
                  placeholder="https://college.edu/dsa/..."
                  value={collegeLink}
                  onChange={(e) => setCollegeLink(e.target.value)}
                  className={styles.input}
                />
              </div>
            </>
          ) : (
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>
                  College Link (Optional)
                  {getSafeUrl(collegeLink) && (
                    <a
                      href={getSafeUrl(collegeLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: '8px', color: 'var(--accent-cyan)', fontSize: '0.75rem' }}
                    >
                      Open ↗
                    </a>
                  )}
                </label>
                <input
                  type="url"
                  placeholder="https://college.edu/dsa/..."
                  value={collegeLink}
                  onChange={(e) => setCollegeLink(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  LeetCode Link (Optional Dual Link)
                  {getSafeUrl(leetcodeLink) && (
                    <a
                      href={getSafeUrl(leetcodeLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: '8px', color: 'var(--accent-cyan)', fontSize: '0.75rem' }}
                    >
                      Open ↗
                    </a>
                  )}
                </label>
                <input
                  type="url"
                  placeholder="https://leetcode.com/problems/..."
                  value={leetcodeLink}
                  onChange={(e) => setLeetcodeLink(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>
          )}

          {/* Difficulty & Source */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Difficulty *</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyType)}
                className={styles.select}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Source *</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className={styles.select}
              >
                {currentSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Learned, Status & Retention */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Date Learned *</label>
              <input
                type="date"
                required
                value={dateLearned}
                onChange={(e) => setDateLearned(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusType)}
                className={styles.select}
              >
                <option value="Not Started">Not Started</option>
                <option value="Attempted">Attempted</option>
                <option value="Solved">Solved</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Retention Level</label>
              <select
                value={retentionLevel}
                onChange={(e) => setRetentionLevel(e.target.value as RetentionType)}
                className={styles.select}
              >
                <option value="Learning">Learning</option>
                <option value="Familiar">Familiar</option>
                <option value="Independent">Independent</option>
                <option value="Strong">Strong</option>
                <option value="Locked">Locked</option>
              </select>
            </div>
          </div>

          {/* Notes & Invariants */}
          <div className={styles.field}>
            <label className={styles.label}>Notes, Invariants & Approach (Optional)</label>
            <textarea
              placeholder="Key invariants, time/space complexities, edge cases to remember..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={styles.textarea}
              rows={3}
            />
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={styles.cancelBtn}
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditMode ? 'Update Problem' : 'Save Problem'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
