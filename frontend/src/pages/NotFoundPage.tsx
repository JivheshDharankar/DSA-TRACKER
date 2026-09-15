import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import styles from '../components/common/PlaceholderCard.module.css';

export const NotFoundPage: React.FC = () => {
  return (
    <div className={styles.card}>
      <div className={styles.iconWrapper} style={{ color: 'var(--color-medium)', borderColor: 'var(--color-medium)' }}>
        <AlertTriangle size={32} />
      </div>
      <h2 className={styles.title}>404 — Page Not Found</h2>
      <p className={styles.description}>
        The route you are looking for does not exist in the DSA Tracker application.
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
          fontWeight: 600,
          borderRadius: 'var(--radius-md)',
          marginTop: 'var(--space-md)',
        }}
      >
        <ArrowLeft size={16} />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
};
