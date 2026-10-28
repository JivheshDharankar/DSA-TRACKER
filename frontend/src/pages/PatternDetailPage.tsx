import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Layers,
  Lock,
  Sparkles,
} from 'lucide-react';
import { fetchPatternDetail } from '../api/patterns.api';
import { AssociatedProblemItem, PatternConfidence, PatternDetailResponse } from '../types';
import { PatternBreakdownCard } from '../components/patterns/PatternBreakdownCard';
import { PatternMasteryBadge } from '../components/patterns/PatternMasteryBadge';
import { Badge, BadgeTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ProgressRing } from '../components/ui/Progress';
import { Skeleton } from '../components/ui/Skeleton';
import { cx } from '../components/ui/cx';
import { difficultyTone, retentionTone, statusTone } from '../components/problems/badgeTones';
import { formatCalendarDate } from '../utils/date.utils';
import styles from './PatternDetailPage.module.css';

/**
 * DSA Tracker — Pattern Detail
 * ============================
 * Everything the pattern master document holds — description, recognition signals,
 * common mistakes, prerequisites and slug — plus the server-computed mastery result and
 * the problems currently attached to this pattern, exactly as
 * `GET /patterns/:idOrSlug` returns them. No field is derived, and the review schedule
 * columns come straight from each attachment (`retentionLevel`, `nextReviewDate`).
 *
 * Data flow is unchanged: the route param is passed to `fetchPatternDetail` as before, so
 * both a Mongo id and a slug keep working.
 *
 * States:
 *   - loading reserves the layout with skeletons;
 *   - a failure renders `ErrorState` with a working **Retry** and a way back to the
 *     library, and a pattern the API reports as missing is worded as "not found";
 *   - an empty attachment list explains where attaching happens instead of showing an
 *     empty table.
 *
 * Attachment itself is deliberately not reimplemented here: the existing
 * `PatternPickerModal` on a problem's detail page stays the single place that assigns
 * patterns, so no second selection UI exists to drift from it.
 */

const CONFIDENCE_TONE: Record<PatternConfidence, BadgeTone> = {
  HIGH: 'success',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

const CONFIDENCE_LABEL: Record<PatternConfidence, string> = {
  HIGH: 'High confidence',
  MEDIUM: 'Medium confidence',
  LOW: 'Low confidence',
};

export const PatternDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<PatternDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPatternDetail = useCallback(async (patternIdOrSlug: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPatternDetail(patternIdOrSlug);
      setData(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load pattern details.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      loadPatternDetail(id);
    }
  }, [id, loadPatternDetail]);

  const backLink = (
    <Link to="/patterns" className={styles.backLink}>
      <ArrowLeft size={14} aria-hidden="true" />
      Pattern Library
    </Link>
  );

  if (error || (!isLoading && !data)) {
    const message = error ?? 'The requested pattern does not exist.';
    const isMissing = /not found|does not exist|404/i.test(message);

    return (
      <div className={styles.page}>
        {backLink}
        <ErrorState
          variant="section"
          title={isMissing ? 'Pattern not found' : "We couldn't load this pattern"}
          message={message}
          onRetry={id ? () => loadPatternDetail(id) : undefined}
          isRetrying={isLoading}
          retryLabel="Retry"
          icon={isMissing ? null : undefined}
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate('/patterns')}>
              Back to Pattern Library
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className={styles.page}>
        {backLink}
        <div className={styles.loading} role="status" aria-busy="true">
          <span className="sr-only">Loading pattern</span>
          <Card className={styles.headerCard} aria-hidden="true">
            <div className={styles.headerMain}>
              <Skeleton width={220} height={26} />
              <Skeleton width={140} height={18} />
              <Skeleton width="90%" height={12} />
              <Skeleton width="70%" height={12} />
            </div>
            <Skeleton shape="circle" width={96} height={96} />
          </Card>
          <Card variant="raised" className={styles.headerCard} aria-hidden="true">
            <Skeleton width={200} height={18} />
            <Skeleton width="100%" height={12} />
            <Skeleton width="85%" height={12} />
          </Card>
        </div>
      </div>
    );
  }

  const { pattern, mastery, associatedProblems } = data;

  return (
    <div className={styles.page}>
      {backLink}

      <Card variant="raised" className={styles.headerCard}>
        <div className={styles.headerMain}>
          <div className={styles.titleRow}>
            <h2 className={styles.patternTitle}>{pattern.name}</h2>
            {/* The ring beside this header already shows the score. */}
            <PatternMasteryBadge level={mastery.masteryLevel} size="lg" showScore={false} />
          </div>

          <span className={styles.slug} title="Pattern slug">
            {pattern.slug}
          </span>

          <p className={styles.patternDesc}>{pattern.description}</p>

          <div className={styles.headerStats}>
            <span className={styles.headerStat}>
              <strong>
                {mastery.solvedCount}/{mastery.problemCount}
              </strong>{' '}
              linked problems solved
            </span>
            <span className={styles.headerStat}>
              <strong>{pattern.recognitionSignals.length}</strong> recognition{' '}
              {pattern.recognitionSignals.length === 1 ? 'signal' : 'signals'}
            </span>
            {pattern.prerequisites.length > 0 ? (
              <span className={styles.headerStat}>
                <strong>{pattern.prerequisites.length}</strong>{' '}
                {pattern.prerequisites.length === 1 ? 'prerequisite' : 'prerequisites'}
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.ringWrap}>
          <ProgressRing
            value={mastery.score}
            max={100}
            size="lg"
            tone="mastery"
            label={`${pattern.name} mastery score`}
          >
            <span className={styles.ringValue}>{mastery.score}</span>
          </ProgressRing>
          <span className={styles.ringCaption}>Mastery score</span>
        </div>
      </Card>

      <PatternBreakdownCard mastery={mastery} patternName={pattern.name} />

      <div className={styles.contentGrid}>
        <div className={styles.column}>
          <Card className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <Sparkles size={16} className={styles.sectionIcon} aria-hidden="true" />
                Recognition Signals
              </h2>
              <Badge tone="neutral">{pattern.recognitionSignals.length}</Badge>
            </div>

            {pattern.recognitionSignals.length > 0 ? (
              <ul className={styles.list}>
                {pattern.recognitionSignals.map((signal) => (
                  <li key={signal} className={styles.listItem}>
                    <span className={styles.bulletDot} aria-hidden="true" />
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyNote}>
                No recognition signals have been recorded for this pattern yet.
              </p>
            )}
          </Card>

          <Card className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <AlertTriangle
                  size={16}
                  className={cx(styles.sectionIcon, styles.sectionIconDanger)}
                  aria-hidden="true"
                />
                Common Mistakes &amp; Pitfalls
              </h2>
              <Badge tone="neutral">{pattern.commonMistakes.length}</Badge>
            </div>

            {pattern.commonMistakes.length > 0 ? (
              <ul className={styles.list}>
                {pattern.commonMistakes.map((mistake) => (
                  <li key={mistake} className={cx(styles.listItem, styles.mistakeItem)}>
                    <span className={styles.bulletDotDanger} aria-hidden="true" />
                    <span>{mistake}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyNote}>
                No pitfalls have been recorded for this pattern yet.
              </p>
            )}
          </Card>

          {pattern.prerequisites.length > 0 ? (
            <Card className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <BookOpen
                    size={16}
                    className={cx(styles.sectionIcon, styles.sectionIconAccent2)}
                    aria-hidden="true"
                  />
                  Prerequisites &amp; Foundations
                </h2>
                <Badge tone="neutral">{pattern.prerequisites.length}</Badge>
              </div>

              <div className={styles.prereqList}>
                {pattern.prerequisites.map((prereq) => (
                  <span key={prereq} className={styles.prereqBadge}>
                    {prereq}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <Card className={cx(styles.sectionCard, styles.problemsCard)}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <Layers size={16} className={styles.sectionIcon} aria-hidden="true" />
              Associated Problems
            </h2>
            <Badge tone="neutral">{associatedProblems.length}</Badge>
          </div>

          {associatedProblems.length > 0 ? (
            <ul className={styles.problemsList}>
              {associatedProblems.map((item) => (
                <AssociatedProblemRow key={item.problem.id} item={item} />
              ))}
            </ul>
          ) : (
            <EmptyState
              variant="compact"
              icon={<Layers size={20} />}
              title="No problems linked to this pattern yet"
              description="Patterns are attached to problems, not the other way around: open a problem's detail page and use the pattern picker there to tag it with this pattern."
            />
          )}
        </Card>
      </div>
    </div>
  );
};

interface AssociatedProblemRowProps {
  item: AssociatedProblemItem;
}

const AssociatedProblemRow: React.FC<AssociatedProblemRowProps> = ({ item }) => {
  const { problem, confidence, isPrimary } = item;
  const isLocked = problem.retentionLevel === 'Locked';

  return (
    <li className={styles.problemRow}>
      <div className={styles.problemTop}>
        <Link to={`/problems/${problem.id}`} className={styles.problemLink}>
          {problem.title}
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>

        <div className={styles.problemTags}>
          {isPrimary ? <Badge tone="accent">Primary pattern</Badge> : null}
          <span className={styles.sNo}>#{problem.sNo}</span>
        </div>
      </div>

      <div className={styles.problemMeta}>
        <Badge tone="neutral" shape="pill">
          {problem.section === 'COLLEGE' ? 'College' : 'Personal'}
        </Badge>
        <Badge tone={difficultyTone(problem.difficulty)} dot>
          {problem.difficulty}
        </Badge>
        <Badge tone={statusTone(problem.status)}>{problem.status}</Badge>
        <Badge tone={retentionTone(problem.retentionLevel)}>
          {isLocked ? (
            <>
              <Lock size={11} aria-hidden="true" />
              <span>{problem.retentionLevel}</span>
            </>
          ) : (
            problem.retentionLevel
          )}
        </Badge>
        <Badge tone={CONFIDENCE_TONE[confidence] ?? 'neutral'}>
          {CONFIDENCE_LABEL[confidence] ?? confidence}
        </Badge>
      </div>

      <p className={styles.problemSchedule}>
        Next review <strong>{formatCalendarDate(problem.nextReviewDate)}</strong>
      </p>
    </li>
  );
};
