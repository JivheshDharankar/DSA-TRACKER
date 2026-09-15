import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  size = 36,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '280px',
        gap: '16px',
      }}
    >
      <Loader2 size={size} color="var(--accent-cyan)" className="animate-spin" />
      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{message}</span>
    </div>
  );
};
