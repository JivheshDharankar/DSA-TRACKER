import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Network, Search, ArrowRight, Sparkles } from 'lucide-react';
import { fetchPatterns } from '../api/patterns.api';
import { PatternWithMastery } from '../types';
import { PatternMasteryBadge } from '../components/patterns/PatternMasteryBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import styles from './PatternsPage.module.css';

export const PatternsPage: React.FC = () => {
  const [patterns, setPatterns] = useState<PatternWithMastery[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchPatterns();
      setPatterns(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load patterns');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered patterns
  const filteredPatterns = useMemo(() => {
    return patterns.filter((pattern) => {
      // Search matching
      const matchesSearch =
        searchQuery.trim() === '' ||
        pattern.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pattern.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pattern.recognitionSignals.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
        pattern.prerequisites.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Mastery filter matching
      if (selectedFilter === 'ALL') return true;
      return pattern.mastery.masteryLevel.toUpperCase() === selectedFilter.toUpperCase();
    });
  }, [patterns, searchQuery, selectedFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = patterns.length;
    const strong = patterns.filter((p) => p.mastery.masteryLevel === 'Strong').length;
    const independent = patterns.filter((p) => p.mastery.masteryLevel === 'Independent').length;
    const familiar = patterns.filter((p) => p.mastery.masteryLevel === 'Familiar').length;
    const learning = patterns.filter((p) => p.mastery.masteryLevel === 'Learning').length;
    const totalProblemsAttached = patterns.reduce((sum, p) => sum + p.mastery.problemCount, 0);

    return { total, strong, independent, familiar, learning, totalProblemsAttached };
  }, [patterns]);

  const filterOptions: Array<{ key: string; label: string; count: number }> = [
    { key: 'ALL', label: 'All Patterns', count: stats.total },
    { key: 'STRONG', label: 'Strong', count: stats.strong },
    { key: 'INDEPENDENT', label: 'Independent', count: stats.independent },
    { key: 'FAMILIAR', label: 'Familiar', count: stats.familiar },
    { key: 'LEARNING', label: 'Learning', count: stats.learning },
  ];

  if (isLoading && patterns.length === 0) {
    return (
      <div className={styles.container}>
        <LoadingSpinner message="Loading algorithmic pattern library..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>
              <Network size={32} color="var(--accent-cyan)" />
              DSA Pattern Library & Mastery
            </h1>
            <p className={styles.subtitle}>
              Track pattern recognition and transfer ability across 30 foundational DSA interview patterns.
              Master patterns to solve unseen variations independently.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Summary Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Patterns</span>
          <span className={styles.statValue}>{stats.total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Independent & Strong</span>
          <span className={styles.statValue} style={{ color: '#34d399' }}>
            {stats.strong + stats.independent}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Familiar & Learning</span>
          <span className={styles.statValue} style={{ color: '#38bdf8' }}>
            {stats.familiar + stats.learning}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Attached Problems</span>
          <span className={styles.statValue} style={{ color: 'var(--accent-violet)' }}>
            {stats.totalProblemsAttached}
          </span>
        </div>
      </div>

      {/* Controls Bar: Search & Filter Pills */}
      <div className={styles.controlsBar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search patterns, recognition signals, prerequisites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterPills}>
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`${styles.filterBtn} ${selectedFilter === opt.key ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedFilter(opt.key)}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className={styles.emptyState}>
          <p style={{ color: 'var(--color-hard)' }}>{error}</p>
          <button type="button" className={styles.filterBtn} onClick={loadPatterns} style={{ marginTop: '1rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Pattern Cards Grid */}
      {filteredPatterns.length > 0 ? (
        <div className={styles.patternGrid}>
          {filteredPatterns.map((pattern) => (
            <Link
              to={`/patterns/${pattern.id}`}
              key={pattern.id}
              className={styles.patternCard}
            >
              <div className={styles.cardTop}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{pattern.name}</h3>
                  <PatternMasteryBadge
                    level={pattern.mastery.masteryLevel}
                    score={pattern.mastery.score}
                    size="sm"
                  />
                </div>

                <p className={styles.cardDescription}>{pattern.description}</p>

                {pattern.recognitionSignals.length > 0 && (
                  <div className={styles.signalsPreview}>
                    <span className={styles.signalLabel}>Recognition Signals</span>
                    <div className={styles.signalText}>
                      <Sparkles size={13} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{pattern.recognitionSignals[0]}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                <div className={styles.prereqTags}>
                  {pattern.prerequisites.slice(0, 2).map((p) => (
                    <span key={p} className={styles.prereqPill}>
                      {p}
                    </span>
                  ))}
                  {pattern.prerequisites.length > 2 && (
                    <span className={styles.prereqPill}>+{pattern.prerequisites.length - 2}</span>
                  )}
                </div>

                <span className={styles.actionLink}>
                  Details <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No patterns match your search criteria.</p>
        </div>
      )}
    </div>
  );
};
