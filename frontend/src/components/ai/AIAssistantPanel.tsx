import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Gauge,
  Lightbulb,
  MessageCircleQuestion,
  NotebookPen,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  AiFeature,
  AiGenerationResponse,
  AiHintLevel,
  AiRecallCategory,
  AiRevisionNotes,
  AiStatus,
  Problem,
} from '../../types';
import { fetchAiStatus, generateAiAssistance, GenerateAiInput } from '../../api/ai.api';
import { updateProblem } from '../../api/problems.api';
import { getErrorMessage } from '../../utils/error.utils';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { cx } from '../ui/cx';
import styles from './AIAssistantPanel.module.css';

/**
 * DSA Tracker — AI study assistant (Phase 2B)
 * ==========================================
 * A single panel on Problem Detail. It is deliberately not a chat: five named actions,
 * each producing one predictable, structured artifact the student can read and learn from.
 *
 * Product rules enforced here:
 *   - suggestions never write themselves: revision notes require an explicit "Save to
 *     problem notes" click, and that is the only write this panel performs;
 *   - nothing in this panel can touch mastery, SRS stage, due date, status or difficulty —
 *     it has no API access to them;
 *   - a failure is shown in place, with a retry, and never blocks the rest of the page;
 *   - when the server has no Gemini key, the panel explains that instead of showing broken
 *     buttons.
 *
 * Privacy: the copy states exactly what leaves the server. Generic actions send only the
 * problem's title, topic, difficulty and source; complexity analysis can additionally send
 * the student's own saved notes/code, and only when they leave that toggle on.
 */

const ACTIONS: Array<{
  feature: AiFeature;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    feature: 'explain',
    label: 'Explain Problem',
    description: 'Understand the problem, not just the answer.',
    icon: <BookOpen size={16} />,
  },
  {
    feature: 'hint',
    label: 'Give me a Hint',
    description: 'A nudge that keeps the solving to you.',
    icon: <Lightbulb size={16} />,
  },
  {
    feature: 'complexity',
    label: 'Analyze Complexity',
    description: 'Time and space, with the reasoning.',
    icon: <Gauge size={16} />,
  },
  {
    feature: 'recall',
    label: 'Generate Recall Questions',
    description: 'Test understanding before the next review.',
    icon: <MessageCircleQuestion size={16} />,
  },
  {
    feature: 'revision-notes',
    label: 'Create Revision Notes',
    description: 'A short artifact you can edit and keep.',
    icon: <NotebookPen size={16} />,
  },
];

const LOADING_LABELS: Record<AiFeature, string> = {
  explain: 'Generating an explanation',
  hint: 'Preparing a hint',
  complexity: 'Analyzing complexity',
  recall: 'Writing recall questions',
  'revision-notes': 'Drafting revision notes',
};

const CATEGORY_LABELS: Record<AiRecallCategory, string> = {
  'core-idea': 'Core idea',
  'pattern-recognition': 'Pattern',
  'why-it-works': 'Why it works',
  'edge-cases': 'Edge cases',
  complexity: 'Complexity',
  'common-mistake': 'Common mistake',
  'what-would-change-if': 'What would change if…',
};

const NOTES_HEADER = '--- AI revision notes';

export const formatRevisionNotes = (notes: AiRevisionNotes): string =>
  [
    `Trigger: ${notes.trigger}`,
    `Key insight: ${notes.keyInsight}`,
    'Algorithm:',
    ...notes.algorithm.map((step, index) => `${index + 1}. ${step}`),
    'Edge cases:',
    ...notes.edgeCases.map((item) => `- ${item}`),
    `Complexity: Time ${notes.complexity.time} · Space ${notes.complexity.space}`,
    `Common mistake: ${notes.commonMistake}`,
    `Recall question: ${notes.recallQuestion}`,
  ].join('\n');

export interface AIAssistantPanelProps {
  problem: Problem;
  /** Called with the updated problem after the student explicitly saves notes. */
  onNotesSaved?: (updated: Problem) => void;
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({ problem, onNotesSaved }) => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);

  const [activeFeature, setActiveFeature] = useState<AiFeature | null>(null);
  const [result, setResult] = useState<AiGenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<GenerateAiInput | null>(null);

  const [hintLevel, setHintLevel] = useState<AiHintLevel>(1);
  const [includeSavedNotes, setIncludeSavedNotes] = useState(true);

  const [notesDraft, setNotesDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchAiStatus();
        if (!cancelled) setStatus(next);
      } catch {
        // A status probe must never break the page: fall back to showing the actions and
        // let the real request surface a precise error.
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setIsStatusLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasSavedNotes = Boolean(problem.notes && problem.notes.trim());
  const isBusy = activeFeature !== null;
  const isDisabled = status !== null && !status.enabled;

  const run = useCallback(
    async (input: GenerateAiInput) => {
      if (isBusy) return;

      setActiveFeature(input.feature);
      setError(null);
      setSaveError(null);
      setLastRequest(input);

      try {
        const response = await generateAiAssistance(problem.id, input);
        setResult(response);

        if (response.feature === 'revision-notes') {
          setNotesDraft(formatRevisionNotes(response.content));
          setSavedAt(null);
        }
        if (response.feature === 'hint') {
          setHintLevel(response.content.level);
        }

        // Move focus to the result so keyboard and screen-reader users land on the answer.
        window.setTimeout(() => resultRef.current?.focus(), 0);
      } catch (err: unknown) {
        setError(
          getErrorMessage(err, 'AI assistance could not complete this request. Please try again.')
        );
      } finally {
        setActiveFeature(null);
      }
    },
    [isBusy, problem.id]
  );

  const handleAction = (feature: AiFeature) => {
    if (feature === 'hint') {
      void run({ feature, level: hintLevel });
      return;
    }
    if (feature === 'complexity') {
      void run({
        feature,
        ...(includeSavedNotes && hasSavedNotes ? { code: problem.notes } : {}),
      });
      return;
    }
    void run({ feature });
  };

  const handleSaveNotes = async () => {
    const draft = notesDraft.trim();
    if (!draft || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const header = `${NOTES_HEADER} (${new Date().toLocaleDateString()}) ---`;
      const merged = hasSavedNotes
        ? `${problem.notes!.trim()}\n\n${header}\n${draft}`
        : draft;

      const updated = await updateProblem(problem.id, { notes: merged });
      setSavedAt(new Date().toLocaleTimeString());
      onNotesSaved?.(updated);
    } catch (err: unknown) {
      setSaveError(
        getErrorMessage(err, 'The notes could not be saved. Your problem was not changed.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const activeLoadingLabel = activeFeature ? LOADING_LABELS[activeFeature] : null;

  const statusNote = useMemo(() => {
    if (!status) return null;
    if (!status.enabled) {
      return (
        <Alert tone="info" title="AI assistance is not configured on this server">
          Every other feature of your tracker works exactly as before. Add a server-side
          <code className={styles.code}>GEMINI_API_KEY</code> to enable these tools.
        </Alert>
      );
    }
    return null;
  }, [status]);

  return (
    <Card variant="compact" className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <h3 className={styles.heading}>
            <Sparkles size={18} aria-hidden="true" />
            <span>AI Study Assistant</span>
          </h3>
          <p className={styles.subheading}>
            Suggestions to help you learn this problem. Nothing here changes your mastery, review
            stage or due date.
          </p>
        </div>
        {status?.enabled ? (
          <Badge tone="neutral" shape="compact">
            {status.model ?? 'Gemini'}
          </Badge>
        ) : null}
      </div>

      {statusNote}

      {!isDisabled ? (
        <>
          <div className={styles.actions} role="group" aria-label="AI assistance actions">
            {ACTIONS.map((action) => {
              const loading = activeFeature === action.feature;
              return (
                <div key={action.feature} className={styles.actionSlot}>
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    iconLeft={action.icon}
                    loading={loading}
                    loadingLabel={LOADING_LABELS[action.feature]}
                    disabled={isBusy && !loading}
                    onClick={() => handleAction(action.feature)}
                  >
                    {action.label}
                  </Button>
                  <p className={styles.actionDescription}>{action.description}</p>
                </div>
              );
            })}
          </div>

          <div className={styles.controls}>
            {result?.feature === 'hint' || activeFeature === 'hint' ? (
              <div className={styles.hintControls}>
                <span className={styles.controlLabel}>Hint level</span>
                <div className={styles.levelGroup} role="group" aria-label="Hint level">
                  {([1, 2, 3] as AiHintLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={cx(styles.levelButton, hintLevel === level && styles.levelActive)}
                      aria-pressed={hintLevel === level}
                      onClick={() => {
                        setHintLevel(level);
                        void run({ feature: 'hint', level });
                      }}
                      disabled={isBusy}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {hasSavedNotes ? (
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={includeSavedNotes}
                  onChange={(event) => setIncludeSavedNotes(event.target.checked)}
                />
                <span>Analyze my saved notes/code with complexity analysis</span>
              </label>
            ) : null}
          </div>
        </>
      ) : null}

      <div aria-live="polite" className={styles.liveRegion}>
        {isStatusLoading ? <p className={styles.loading}>Checking AI availability…</p> : null}
        {activeLoadingLabel ? (
          <p className={styles.loading} role="status">
            {activeLoadingLabel}… this can take a few seconds.
          </p>
        ) : null}
      </div>

      {error ? (
        <Alert
          tone="danger"
          title="AI assistance failed"
          action={
            lastRequest ? (
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<RotateCcw size={14} />}
                onClick={() => void run(lastRequest)}
                disabled={isBusy}
              >
                Retry
              </Button>
            ) : null
          }
        >
          {error}
        </Alert>
      ) : null}

      {result ? (
        <div
          className={styles.result}
          ref={resultRef}
          tabIndex={-1}
          aria-label={`${ACTIONS.find((action) => action.feature === result.feature)?.label ?? 'AI suggestion'} result`}
        >
          <div className={styles.resultHeader}>
            <span className={styles.resultHeading}>
              {ACTIONS.find((action) => action.feature === result.feature)?.label}
            </span>
            {result.cached ? (
              <Badge tone="neutral" shape="compact">
                Cached
              </Badge>
            ) : null}
          </div>

          {renderResult(result)}

          {result.feature === 'revision-notes' ? (
            <div className={styles.notesBlock}>
              <label className={styles.notesLabel} htmlFor="ai-notes-draft">
                Edit before saving
              </label>
              <textarea
                id="ai-notes-draft"
                className={styles.notesEditor}
                value={notesDraft}
                rows={12}
                onChange={(event) => {
                  setNotesDraft(event.target.value);
                  setSavedAt(null);
                }}
              />

              {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
              {savedAt ? (
                <Alert tone="success" title={`Saved to this problem’s notes at ${savedAt}`}>
                  Your notes were updated. Mastery and review scheduling were not affected.
                </Alert>
              ) : null}

              <div className={styles.saveRow}>
                <p className={styles.saveHint}>
                  {hasSavedNotes
                    ? 'Saved beneath your existing notes — nothing is overwritten.'
                    : 'This will be saved as this problem’s notes.'}
                </p>
                <Button
                  size="sm"
                  iconLeft={<Save size={14} />}
                  onClick={() => void handleSaveNotes()}
                  loading={isSaving}
                  loadingLabel="Saving…"
                  disabled={!notesDraft.trim() || isSaving}
                >
                  Save to problem notes
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isDisabled ? (
        <p className={styles.privacy}>
          Requests send this problem’s title, topic, difficulty and source to Google Gemini.
          Complexity analysis can also send your saved notes or code when the toggle above is on.
          No account, email, password or token is sent. AI output can be wrong — verify before
          trusting it.
        </p>
      ) : null}
    </Card>
  );
};

// --------------------------------------------------------------------- renderers

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className={styles.section}>
    <h4 className={styles.sectionTitle}>{title}</h4>
    {children}
  </section>
);

const BulletList: React.FC<{ items: string[]; ordered?: boolean }> = ({ items, ordered }) => {
  const ListTag = ordered ? 'ol' : 'ul';
  return (
    <ListTag className={cx(styles.list, ordered && styles.orderedList)}>
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
      ))}
    </ListTag>
  );
};

const ComplexityPair: React.FC<{ time: string; space: string }> = ({ time, space }) => (
  <div className={styles.complexityRow}>
    <span className={styles.complexityItem}>
      <span className={styles.complexityLabel}>Time</span>
      <Badge tone="accent" shape="pill">
        {time}
      </Badge>
    </span>
    <span className={styles.complexityItem}>
      <span className={styles.complexityLabel}>Space</span>
      <Badge tone="info" shape="pill">
        {space}
      </Badge>
    </span>
  </div>
);

const renderResult = (result: AiGenerationResponse): React.ReactNode => {
  switch (result.feature) {
    case 'explain':
      return (
        <>
          <p className={styles.prose}>{result.content.summary}</p>

          <Section title="What to notice">
            <BulletList items={result.content.observations} />
          </Section>

          <Section title="Constraints that matter">
            <BulletList items={result.content.constraints} />
          </Section>

          <Section title="Intuition">
            <p className={styles.prose}>{result.content.intuition}</p>
          </Section>

          <Section title="Step-by-step approach">
            <BulletList items={result.content.approach} ordered />
          </Section>

          <Section title="Why it works">
            <p className={styles.prose}>{result.content.correctness}</p>
          </Section>

          <Section title="Complexity">
            <ComplexityPair time={result.content.complexity.time} space={result.content.complexity.space} />
          </Section>

          <Section title="Edge cases">
            <BulletList items={result.content.edgeCases} />
          </Section>
        </>
      );

    case 'hint':
      return (
        <div className={styles.hintBox}>
          <div className={styles.hintHeader}>
            <Badge tone="warning" shape="compact">
              Hint {result.content.level} of 3
            </Badge>
            <span className={styles.hintTitle}>{result.content.title}</span>
          </div>
          <p className={styles.prose}>{result.content.hint}</p>
          <p className={styles.nextStep}>
            <strong>Try next:</strong> {result.content.nextStep}
          </p>
          <p className={styles.hintFootnote}>
            {result.content.level < 3
              ? 'Stuck? Pick the next hint level above — but try this one first.'
              : 'That is the most specific hint available. The rest of the implementation is yours.'}
          </p>
        </div>
      );

    case 'complexity':
      return (
        <>
          <p className={styles.subjectNote}>
            {result.content.subject === 'user-code'
              ? 'Analyzing your current approach (your saved notes/code).'
              : 'Analyzing the recommended approach. No code was analyzed for this run.'}
          </p>
          <ComplexityPair time={result.content.time} space={result.content.space} />
          <Section title="Reasoning">
            <p className={styles.prose}>{result.content.reasoning}</p>
          </Section>
          <Section title="Bottlenecks">
            <BulletList items={result.content.bottlenecks} />
          </Section>
          <Section title="Assumptions & caveats">
            <BulletList items={result.content.caveats} />
          </Section>
        </>
      );

    case 'recall':
      return (
        <ol className={styles.questionList}>
          {result.content.questions.map((item, index) => (
            <li key={`${index}-${item.question.slice(0, 24)}`} className={styles.question}>
              <div className={styles.questionHeader}>
                <Badge tone="neutral" shape="compact">
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </Badge>
                <span className={styles.questionText}>{item.question}</span>
              </div>
              <details className={styles.answerDetails}>
                <summary className={styles.answerSummary}>Show model answer</summary>
                <p className={styles.answerText}>{item.answer}</p>
              </details>
            </li>
          ))}
        </ol>
      );

    case 'revision-notes':
      return (
        <>
          <Section title="Trigger">
            <p className={styles.prose}>{result.content.trigger}</p>
          </Section>
          <Section title="Key insight">
            <p className={styles.prose}>{result.content.keyInsight}</p>
          </Section>
          <Section title="Algorithm skeleton">
            <BulletList items={result.content.algorithm} ordered />
          </Section>
          <Section title="Edge cases">
            <BulletList items={result.content.edgeCases} />
          </Section>
          <ComplexityPair time={result.content.complexity.time} space={result.content.complexity.space} />
          <Section title="Common mistake">
            <p className={styles.prose}>{result.content.commonMistake}</p>
          </Section>
          <Section title="Recall question">
            <p className={styles.prose}>{result.content.recallQuestion}</p>
          </Section>
        </>
      );

    default:
      return null;
  }
};
