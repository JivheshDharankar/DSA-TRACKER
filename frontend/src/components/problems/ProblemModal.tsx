import React, { useState, useEffect } from 'react';
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
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Field } from '../ui/Field';
import { Alert, AlertTone } from '../ui/Alert';
import { cx } from '../ui/cx';
import { LeetcodeImportPanel } from './LeetcodeImportPanel';
import { LeetcodeImportPreview } from '../../types';
import styles from './ProblemModal.module.css';

/**
 * DSA Tracker — problem create/edit dialog (Phase 9)
 * ==================================================
 * The form now renders inside the shared `Dialog` primitive: portal, `role="dialog"`,
 * accessible name/description, focus trap, Escape, body scroll lock and focus
 * restoration all come from that component. This module owns only the form itself.
 *
 * Behaviour is unchanged: the same fields, defaults, validation messages, submit
 * payloads, pattern attachment calls and error handling run on the same handlers as
 * before. Controls use the Phase 2 `Input`, `Select` and `Field` primitives, so labels,
 * `aria-invalid`, `aria-describedby`, focus rings and the 16px mobile control text are
 * shared with the rest of the redesign.
 *
 * Layout: two columns on wide screens, three for the short date/status/retention row;
 * both collapse to one column on mobile. The panel is scrollable, so the actions stay
 * reachable at 390px and at short viewport heights without scrolling the page behind.
 *
 * Phase 2A adds one thing: for a new Personal problem the dialog can start from a LeetCode
 * URL. That path is a preview only — it fills in the same fields this form already owns and
 * the existing Save button still persists the problem through the same handler, so an
 * imported problem is identical to a manually entered one.
 */

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
  const canImportFromLeetcode = !isEditMode && section === 'PERSONAL';

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

  /** `import` shows the LeetCode panel; `manual` is the original form. */
  const [entryMode, setEntryMode] = useState<'manual' | 'import'>('manual');
  const [importNotice, setImportNotice] = useState<{ tone: AlertTone; text: string } | null>(null);

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
      setEntryMode('manual');
      setImportNotice(null);

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
      setEntryMode('manual');
      setImportNotice(null);
    }
    setErrorMessage(null);
  }, [problemToEdit, section, isOpen]);

  /**
   * Applies an import preview to the normal form and returns to it. Only fields LeetCode
   * actually provides are touched; `topic` stays empty because it is a required judgement
   * call the user makes. A `null` preview means retrieval failed entirely, so only the
   * pasted URL is carried over.
   */
  const handleImportApply = (preview: LeetcodeImportPreview | null, rawUrl: string) => {
    setEntryMode('manual');

    if (preview) {
      setTitle(preview.title ?? preview.suggestedTitle);
      if (preview.difficulty) setDifficulty(preview.difficulty);
      setLeetcodeLink(preview.url);
      setLeetcodeNumber(preview.leetcodeNumber ? String(preview.leetcodeNumber) : '');
      setSource('LeetCode');

      setImportNotice({
        tone: preview.status === 'IMPORTED' ? 'success' : 'info',
        text:
          preview.status === 'IMPORTED'
            ? 'Imported from LeetCode. Review the details, add a topic, and save.'
            : preview.status === 'PARTIAL'
              ? "Some details couldn't be retrieved. Review what was imported, complete the rest, and save."
              : "We couldn't retrieve this problem automatically, so the title and link were filled in from the URL. Check them, add the remaining details, and save.",
      });
      return;
    }

    if (rawUrl.trim().match(/^https?:\/\//i)) {
      setLeetcodeLink(rawUrl.trim());
      setSource('LeetCode');
    }
    setImportNotice({
      tone: 'info',
      text: "We couldn't import this problem automatically. You can enter the problem details manually.",
    });
  };

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
  const safeCollegeLink = getSafeUrl(collegeLink);
  const safeLeetcodeLink = getSafeUrl(leetcodeLink);

  const linkHint = (safeUrl: string | undefined) =>
    safeUrl ? (
      <a href={safeUrl} target="_blank" rel="noopener noreferrer" className={styles.linkHint}>
        Open ↗<span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : undefined;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={isEditMode ? `Edit Problem #${problemToEdit?.sNo}` : `Add ${section === 'COLLEGE' ? 'College' : 'Personal'} DSA Problem`}
      description={<span className={styles.sectionTag}>{section} DSA</span>}
      size="lg"
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

        {canImportFromLeetcode ? (
          <div className={styles.modeSwitch} role="group" aria-label="How to add this problem">
            <button
              type="button"
              className={cx(styles.modeOption, entryMode === 'manual' && styles.modeOptionActive)}
              aria-pressed={entryMode === 'manual'}
              onClick={() => setEntryMode('manual')}
            >
              Manual entry
            </button>
            <button
              type="button"
              className={cx(styles.modeOption, entryMode === 'import' && styles.modeOptionActive)}
              aria-pressed={entryMode === 'import'}
              onClick={() => setEntryMode('import')}
            >
              Import from LeetCode
            </button>
          </div>
        ) : null}

        {entryMode === 'import' ? (
          <LeetcodeImportPanel onApply={handleImportApply} disabled={isSubmitting} />
        ) : (
          <>
            {importNotice ? <Alert tone={importNotice.tone}>{importNotice.text}</Alert> : null}

            <div className={styles.metaRow}>
              <span className={styles.metaItem}>
                <span className={styles.metaLabel}>S.No</span>
                <strong className={styles.metaValue}>
                  {isEditMode ? `#${problemToEdit?.sNo}` : 'Auto-generated on save'}
                </strong>
              </span>
              <span className={styles.metaDivider} aria-hidden="true" />
              <span className={styles.metaHint}>
                {isEditMode ? 'Editing an existing problem' : 'Added to the end of this tracker'}
              </span>
            </div>

            <Input
              label="Problem Title"
              required
              placeholder="e.g. Longest Substring Without Repeating Characters"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className={styles.grid}>
              <Input
                label="Topic"
                required
                placeholder="e.g. Arrays, Strings, Trees, DP"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />

              <Select
                label="Primary Pattern (Optional)"
                id="primary-pattern-select"
                value={selectedPatternId}
                onChange={(e) => setSelectedPatternId(e.target.value)}
                hint="Used for pattern mastery on the dashboard"
              >
                <option value="">None / Unspecified</option>
                {availablePatterns.map((pat) => (
                  <option key={pat.id} value={pat.id}>
                    {pat.name}
                  </option>
                ))}
              </Select>
            </div>

            {section === 'PERSONAL' ? (
              <>
                <div className={styles.grid}>
                  <Field label="LeetCode Link (Optional)" hint={linkHint(safeLeetcodeLink)}>
                    <Input
                      type="url"
                      placeholder="https://leetcode.com/problems/..."
                      value={leetcodeLink}
                      onChange={(e) => setLeetcodeLink(e.target.value)}
                    />
                  </Field>

                  <Input
                    label="LeetCode Number (Optional)"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="e.g. 3"
                    value={leetcodeNumber}
                    onChange={(e) => setLeetcodeNumber(e.target.value)}
                  />
                </div>

                <Field label="College Link (Optional Dual Link)" hint={linkHint(safeCollegeLink)}>
                  <Input
                    type="url"
                    placeholder="https://college.edu/dsa/..."
                    value={collegeLink}
                    onChange={(e) => setCollegeLink(e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <div className={styles.grid}>
                <Field label="College Link (Optional)" hint={linkHint(safeCollegeLink)}>
                  <Input
                    type="url"
                    placeholder="https://college.edu/dsa/..."
                    value={collegeLink}
                    onChange={(e) => setCollegeLink(e.target.value)}
                  />
                </Field>

                <Field label="LeetCode Link (Optional Dual Link)" hint={linkHint(safeLeetcodeLink)}>
                  <Input
                    type="url"
                    placeholder="https://leetcode.com/problems/..."
                    value={leetcodeLink}
                    onChange={(e) => setLeetcodeLink(e.target.value)}
                  />
                </Field>
              </div>
            )}

            <div className={styles.grid}>
              <Select
                label="Difficulty"
                required
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyType)}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </Select>

              <Select
                label="Source"
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {currentSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>

            <div className={styles.gridThree}>
              <Input
                label="Date Learned"
                type="date"
                required
                value={dateLearned}
                onChange={(e) => setDateLearned(e.target.value)}
              />

              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusType)}
              >
                <option value="Not Started">Not Started</option>
                <option value="Attempted">Attempted</option>
                <option value="Solved">Solved</option>
              </Select>

              <Select
                label="Retention Level"
                value={retentionLevel}
                onChange={(e) => setRetentionLevel(e.target.value as RetentionType)}
              >
                <option value="Learning">Learning</option>
                <option value="Familiar">Familiar</option>
                <option value="Independent">Independent</option>
                <option value="Strong">Strong</option>
                <option value="Locked">Locked</option>
              </Select>
            </div>

            <Field label="Notes, Invariants & Approach (Optional)" id="problem-notes">
              <textarea
                id="problem-notes"
                placeholder="Key invariants, time/space complexities, edge cases to remember..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={styles.textarea}
                rows={4}
              />
            </Field>

            <div className={styles.actions}>
              <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting} loadingLabel="Saving...">
                {isEditMode ? 'Update Problem' : 'Save Problem'}
              </Button>
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
};
