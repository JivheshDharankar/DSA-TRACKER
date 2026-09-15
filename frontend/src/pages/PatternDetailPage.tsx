import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Layers,
  Sparkles,
} from 'lucide-react';
import { fetchPatternDetail } from '../api/patterns.api';
import { PatternDetailResponse } from '../types';
import { PatternBreakdownCard } from '../components/patterns/PatternBreakdownCard';
import { DifficultyBadge } from '../components/problems/DifficultyBadge';
import { StatusBadge } from '../components/problems/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import styles from './PatternDetailPage.module.css';

export const PatternDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PatternDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadPatternDetail(id);
    }
  }, [id]);

  const loadPatternDetail = async (patternIdOrSlug: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchPatternDetail(patternIdOrSlug);
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load pattern details');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <LoadingSpinner message="Loading pattern mastery..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <Link to="/patterns" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to Pattern Library
        </Link>
        <div className={styles.header}>
          <h2 style={{ color: 'var(--color-hard)' }}>Pattern Not Found</h2>
          <p>{error || 'The requested pattern does not exist.'}</p>
        </div>
      </div>
    );
  }

  const { pattern, mastery, associatedProblems } = data;

  return (
    <div className={styles.container}>
      {/* Back Link */}
      <Link to="/patterns" className={styles.backLink}>
        <ArrowLeft size={16} /> Back to Pattern Library
      </Link>

      {/* Pattern Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.patternTitle}>{pattern.name}</h1>
            <span className={styles.patternSlug}>{pattern.slug}</span>
          </div>
        </div>
        <p className={styles.patternDesc}>{pattern.description}</p>
      </div>

      {/* 5-Factor Mastery Breakdown Card */}
      <PatternBreakdownCard mastery={mastery} patternName={pattern.name} />

      {/* 2-Column Grid: Left (Educational Details), Right (Associated Problems) */}
      <div className={styles.contentGrid}>
        {/* Left Column: Educational Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Recognition Signals */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>
              <Sparkles size={18} color="var(--accent-cyan)" />
              Recognition Signals
            </h3>
            <div className={`${styles.list} ${styles.signalsList}`}>
              {pattern.recognitionSignals.map((signal, idx) => (
                <div key={idx} className={styles.listItem}>
                  <CheckCircle2
                    size={16}
                    color="var(--accent-cyan)"
                    style={{ flexShrink: 0, marginTop: 3 }}
                  />
                  <span>{signal}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Common Mistakes */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>
              <AlertTriangle size={18} color="#fca5a5" />
              Common Mistakes & Pitfalls
            </h3>
            <div className={styles.list}>
              {pattern.commonMistakes.map((mistake, idx) => (
                <div key={idx} className={`${styles.listItem} ${styles.mistakeItem}`}>
                  <AlertTriangle
                    size={15}
                    color="#f87171"
                    style={{ flexShrink: 0, marginTop: 3 }}
                  />
                  <span>{mistake}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prerequisites */}
          {pattern.prerequisites.length > 0 && (
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>
                <BookOpen size={18} color="var(--accent-violet)" />
                Prerequisites & Foundations
              </h3>
              <div className={styles.prereqList}>
                {pattern.prerequisites.map((prereq, idx) => (
                  <span key={idx} className={styles.prereqBadge}>
                    {prereq}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Associated User Problems */}
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>
            <Layers size={18} color="var(--accent-cyan)" />
            Associated Problems ({associatedProblems.length})
          </h3>

          {associatedProblems.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.problemsTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Problem</th>
                    <th>Difficulty</th>
                    <th>Status</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {associatedProblems.map((item) => (
                    <tr key={item.problem.id} className={styles.problemRow}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        {item.problem.sNo}
                      </td>
                      <td>
                        <Link
                          to={`/problems/${item.problem.id}`}
                          className={styles.problemLink}
                        >
                          {item.problem.title}
                          {item.isPrimary && <span className={styles.primaryTag}>Primary</span>}
                        </Link>
                      </td>
                      <td>
                        <DifficultyBadge difficulty={item.problem.difficulty} />
                      </td>
                      <td>
                        <StatusBadge status={item.problem.status} />
                      </td>
                      <td>
                        <span
                          className={`${styles.confidenceBadge} ${
                            item.confidence === 'HIGH'
                              ? styles.confidenceHigh
                              : item.confidence === 'MEDIUM'
                              ? styles.confidenceMedium
                              : styles.confidenceLow
                          }`}
                        >
                          {item.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyProblems}>
              <p>No problems linked to this pattern yet.</p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                Attach this pattern from any problem's detail page or problem modal.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
