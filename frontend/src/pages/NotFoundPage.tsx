import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

/**
 * DSA Tracker — 404
 * =================
 * The catch-all route inside `AppShell`. It is the shared `EmptyState` in its `full`
 * variant, so it inherits the same surface, spacing and type as every other empty screen
 * instead of the legacy cyan-glow placeholder card it used to borrow.
 */
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <EmptyState
      variant="full"
      /* The shell owns the document <h1>; a level-2 title keeps this page in the same
         heading hierarchy as every other route instead of skipping a level. */
      titleAs="h2"
      icon={<AlertTriangle size={24} />}
      title="404 — Page not found"
      description="The route you are looking for does not exist in the DSA Tracker application."
      primaryAction={
        <Button iconLeft={<ArrowLeft size={16} />} onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </Button>
      }
    />
  );
};
