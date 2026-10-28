import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Network, Repeat, Search, Sparkles } from 'lucide-react';
import { fetchPatterns } from '../api/patterns.api';
import { PatternMasteryLevel, PatternWithMastery } from '../types';
import { PatternMasteryBadge } from '../components/patterns/PatternMasteryBadge';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { Progress, ProgressTone } from '../components/ui/Progress';
import { Skeleton } from '../components/ui/Skeleton';
import { cx } from '../components/ui/cx';
import styles from './PatternsPage.module.css';

/**
 * DSA Tracker — Pattern Library
 * =============================
 * The browsing half of the mastery feature, restyled onto the Phase 2 primitives and
 * `styles/tokens.css`. It shows exactly what `GET /patterns` returns — the pattern name,
 * slug, description, recognition signals, common mistakes and prerequisites, plus the
 * server-computed mastery result (`score`, `masteryLevel`, the five-factor `breakdown`,
 * `problemCount`, `solvedCount`). Nothing is derived or invented here.
 *
 * Behaviour is preserved from the previous implementation:
 *   - the catalog is fetched once through `fetchPatterns()` with no arguments;
 *   - the search box matches name, description, recognition signals and prerequisites;
 *   - the mastery filters are the same four levels, and their counts come from the full
 *     catalog rather than the currently filtered list;
 *   - each card still links to `/patterns/:id`.
 *
 * What changed is presentational and state-handling:
 *   - loading reserves the grid with skeleton cards, so the page does not jump;
 *   - a failed request renders `ErrorState` with a working **Retry**, and can never fall
 *     through to the genuine-empty state;
 *   - "catalog is empty" and "nothing matched" are distinct `EmptyState`s, and the second
 *     one can clear the search and filters in a single action.
 *
 * The grid is `minmax(min(100%, 320px), 1fr)`, so it is one column on a phone and never
 * causes horizontal scrolling at any width.
 */

type MasteryFilter = 'ALL' | PatternMasteryLevel;

/** Bar tone per level — the same semantic mapping the mastery chip uses. */
const LEVEL_PROGRESS_TONE: Record<PatternMasteryLevel, ProgressTone> = {
  Learning: 'muted',
  Familiar: 'info',
  Independent: 'accent',
  Strong: 'success',
};

const MASTERY_LEVELS: PatternMasteryLevel[] = ['Strong', 'Independent', 'Familiar', 'Learning'];

const FILTER_LABELS: Record<MasteryFilter, string> = {
  ALL: 'All patterns',
  Strong: 'Strong',
  Independent: 'Independent',
  Familiar: 'Familiar',
  Learning: 'Learning',
};

export const PatternsPage: React.FC = () => {
  const navigate = useNavigate();

  const [patterns, setPatterns] = useState<PatternWithMastery[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>('ALL');

  const loadPatterns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPatterns();
      setPatterns(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load patterns.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredPatterns = useMemo(() => {
    return patterns.filter((pattern) => {
      const matchesSearch =
        normalizedQuery === '' ||
        pattern.name.toLowerCase().includes(normalizedQuery) ||
        pattern.description.toLowerCase().includes(normalizedQuery) ||
        pattern.recognitionSignals.some((signal) =>
          signal.toLowerCase().includes(normalizedQuery)
        ) ||
        pattern.prerequisites.some((prereq) => prereq.toLowerCase().includes(normalizedQuery));

      if (!matchesSearch) return false;

      if (masteryFilter === 'ALL') return true;
      return pattern.mastery.masteryLevel === masteryFilter;
    });
  }, [patterns, normalizedQuery, masteryFilter]);

  /** Counts always describe the whole catalog, not the filtered list. */
  const stats = useMemo(() => {
    const levelCounts: Record<PatternMasteryLevel, number> = {
      Strong: 0,
      Independent: 0,
      Familiar: 0,
      Learning: 0,
    };
    let solved = 0;
    let linked = 0;

    for (const pattern of patterns) {
      const level = pattern.mastery.masteryLevel;
      if (levelCounts[level] !== undefined) {
        levelCounts[level] += 1;
      }
      solved += pattern.mastery.solvedCount;
      linked += pattern.mastery.problemCount;
    }

    return {
      total: patterns.length,
      levelCounts,
      mastered: levelCounts.Strong + levelCounts.Independent,
      developing: levelCounts.Familiar + levelCounts.Learning,
      solved,
      linked,
    };
  }, [patterns]);

  const filterOptions: Array<{ key: MasteryFilter; count: number }> = [
    { key: 'ALL', count: stats.total },
    ...MASTERY_LEVELS.map((level) => ({ key: level, count: stats.levelCounts[level] })),
  ];

  const hasActiveControls = normalizedQuery !== '' || masteryFilter !== 'ALL';

  const clearControls = () => {
    setSearchQuery('');
    setMasteryFilter('ALL');
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.iconTile} aria-hidden="true">
            <Network size={20} />
          </span>
          <div className={styles.headingText}>
            <h2 className={styles.title}>Pattern Library &amp; Mastery</h2>
            <p className={styles.subtitle}>
              Track pattern recognition and transfer ability across the catalog. A pattern is
              mastered by cold-solving its variants independently, not by counting problems.
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          {!isLoading && !error ? (
            <Badge tone="neutral" shape="pill">
              {stats.total} {stats.total === 1 ? 'pattern' : 'patterns'}
            </Badge>
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
          title="We couldn't load the pattern library"
          message={error}
          onRetry={loadPatterns}
          isRetrying={isLoading}
          retryLabel="Retry"
        />
      ) : (
        <>
          {isLoading && patterns.length === 0 ? (
            <PatternGridSkeleton />
          ) : patterns.length === 0 ? (
            <EmptyState
              variant="full"
              icon={<Network size={24} />}
              title="No patterns in the library yet"
              description="Patterns come from the shared catalog. As soon as it has entries, each one appears here with the mastery you have earned on it."
              secondaryAction={
                <Button variant="secondary" onClick={loadPatterns}>
                  Reload
                </Button>
              }
            />
          ) : (
            <>
              <dl className={styles.stats}>
                <StatTile
                  label="In catalog"
                  value={stats.total}
                  hint="Patterns available to attach"
                />
                <StatTile
                  label="Mastered"
                  value={stats.mastered}
                  hint={`${stats.levelCounts.Strong} strong · ${stats.levelCounts.Independent} independent`}
                  tone="success"
                />
                <StatTile
                  label="Developing"
                  value={stats.developing}
                  hint={`${stats.levelCounts.Familiar} familiar · ${stats.levelCounts.Learning} learning`}
                  tone="info"
                />
                <StatTile
                  label="Linked problems"
                  value={stats.linked}
                  hint={`${stats.solved} solved`}
                  tone="accent"
                />
              </dl>

              <section className={styles.controls} aria-label="Search and filter patterns">
                <div className={styles.searchField}>
                  <Search size={16} className={styles.searchIcon} aria-hidden="true" />
                  <Input
                    type="search"
                    aria-label="Search patterns"
                    placeholder="Search patterns, signals, prerequisites…"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className={styles.searchInput}
                  />
                </div>

                <div
                  className={styles.filterGroup}
                  role="group"
                  aria-label="Filter patterns by mastery level"
                >
                  {filterOptions.map((option) => {
                    const isActive = masteryFilter === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={cx(styles.filterBtn, isActive && styles.filterBtnActive)}
                        aria-pressed={isActive}
                        onClick={() => setMasteryFilter(option.key)}
                      >
                        {FILTER_LABELS[option.key]}
                        <span className={styles.filterCount}>{option.count}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <p className={styles.resultSummary} aria-live="polite">
                Showing <strong>{filteredPatterns.length}</strong> of{' '}
                <strong>{stats.total}</strong> patterns
                {hasActiveControls ? ' matching your search and filters' : ''}
              </p>

              {filteredPatterns.length === 0 ? (
                <EmptyState
                  variant="full"
                  icon={<Search size={24} />}
                  title="No patterns match"
                  description={
                    normalizedQuery
                      ? `Nothing in the library matches “${searchQuery.trim()}”${
                          masteryFilter === 'ALL'
                            ? ''
                            : ` with ${masteryFilter.toLowerCase()} mastery`
                        }.`
                      : `No pattern currently has ${masteryFilter.toLowerCase()} mastery.`
                  }
                  primaryAction={
                    <Button onClick={clearControls}>Clear search and filters</Button>
                  }
                />
              ) : (
                <ul className={styles.grid}>
                  {filteredPatterns.map((pattern) => (
                    <li key={pattern.id}>
                      <Link to={`/patterns/${pattern.id}`} className={styles.cardLink}>
                        <Card interactive className={styles.card}>
                          <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>{pattern.name}</h2>
                            <PatternMasteryBadge
                              level={pattern.mastery.masteryLevel}
                              score={pattern.mastery.score}
                              size="sm"
                            />
                          </div>

                          <p className={styles.cardDescription}>{pattern.description}</p>

                          <div className={styles.masteryRow}>
                            <div className={styles.masteryMeta}>
                              <span className={styles.masteryLabel}>Mastery</span>
                              <span className={styles.masteryValue}>
                                {pattern.mastery.score}/100
                              </span>
                            </div>
                            <Progress
                              value={pattern.mastery.score}
                              max={100}
                              size="sm"
                              tone={LEVEL_PROGRESS_TONE[pattern.mastery.masteryLevel] ?? 'accent'}
                              label={`${pattern.name} mastery score`}
                            />
                          </div>

                          <div className={styles.cardMeta}>
                            <Badge tone="neutral">
                              {pattern.mastery.solvedCount}/{pattern.mastery.problemCount} solved
                            </Badge>
                            <Badge tone="neutral">
                              {pattern.mastery.problemCount}{' '}
                              {pattern.mastery.problemCount === 1 ? 'problem' : 'problems'} linked
                            </Badge>
                          </div>

                          {pattern.recognitionSignals.length > 0 ? (
                            <div className={styles.signal}>
                              <span className={styles.signalLabel}>
                                <Sparkles size={12} aria-hidden="true" />
                                Recognise it when
                              </span>
                              <p className={styles.signalText}>{pattern.recognitionSignals[0]}</p>
                            </div>
                          ) : null}

                          <div className={styles.cardFooter}>
                            <div className={styles.chips}>
                              {pattern.prerequisites.slice(0, 2).map((prereq) => (
                                <span key={prereq} className={styles.chip}>
                                  {prereq}
                                </span>
                              ))}
                              {pattern.prerequisites.length > 2 ? (
                                <span className={styles.chip}>
                                  +{pattern.prerequisites.length - 2} more
                                </span>
                              ) : null}
                              {pattern.prerequisites.length === 0 ? (
                                <span className={styles.chipMuted}>
                                  No prerequisites listed
                                </span>
                              ) : null}
                            </div>

                            <span className={styles.cardAction}>
                              View pattern
                              <ArrowRight size={14} aria-hidden="true" />
                            </span>
                          </div>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

interface StatTileProps {
  label: string;
  value: number;
  hint: string;
  tone?: 'accent' | 'success' | 'info';
}

const StatTile: React.FC<StatTileProps> = ({ label, value, hint, tone }) => (
  <div className={styles.statTile}>
    <dt className={styles.statLabel}>{label}</dt>
    <dd className={styles.statBody}>
      <span
        className={cx(
          styles.statValue,
          tone === 'success' && styles.statValueSuccess,
          tone === 'info' && styles.statValueInfo,
          tone === 'accent' && styles.statValueAccent
        )}
      >
        {value}
      </span>
      <span className={styles.statHint}>{hint}</span>
    </dd>
  </div>
);

const PatternGridSkeleton: React.FC = () => (
  <div className={styles.grid} role="status" aria-busy="true">
    <span className="sr-only">Loading pattern library</span>
    {[0, 1, 2, 3, 4, 5].map((index) => (
      <Card key={index} className={styles.card} aria-hidden="true">
        <div className={styles.cardHeader}>
          <Skeleton width={140} height={18} />
          <Skeleton width={96} height={20} />
        </div>
        <Skeleton width="100%" height={12} />
        <Skeleton width="80%" height={12} />
        <Skeleton width="55%" height={8} />
        <Skeleton width="70%" height={12} />
      </Card>
    ))}
  </div>
);
