import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { LeetcodeImportPreview } from '../../types';
import { importLeetcodeProblem } from '../../api/problems.api';
import { getErrorMessage } from '../../utils/error.utils';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import styles from './LeetcodeImportPanel.module.css';

/**
 * DSA Tracker — LeetCode import panel (Phase 2A)
 * ==============================================
 * A small extension of the existing Add Problem dialog, not a new screen: it collects a
 * LeetCode URL, asks the backend for a preview, and hands the confirmed values back to the
 * dialog's normal form. Persistence is still the dialog's existing "Save Problem" submit.
 *
 * Failure is a first-class outcome:
 *   - invalid URL        → inline field message, nothing is requested;
 *   - partial metadata   → available fields shown, the rest left for the user;
 *   - unavailable/error  → warning banner with "Enter details manually", which prefills
 *                          the URL (and a slug-derived title suggestion) and switches back
 *                          to the normal form. The user is never left in a dead end.
 *
 * Only imported fields are touched (title, difficulty, LeetCode link/number, source).
 * Topic stays a deliberate manual choice — it is required and not reliably available.
 */

const SLUG_LIKE = /^[a-zA-Z0-9-]+$/;

const looksLikeLeetcodeProblemUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const host = url.hostname.toLowerCase();
    if (host !== 'leetcode.com' && host !== 'www.leetcode.com') return false;
    const segments = url.pathname.split('/').filter(Boolean);
    return segments[0] === 'problems' && Boolean(segments[1]) && SLUG_LIKE.test(segments[1]!);
  } catch {
    return false;
  }
};

export interface LeetcodeImportPanelProps {
  /** Called with the preview (or `null` when nothing could be retrieved) and the pasted URL. */
  onApply: (preview: LeetcodeImportPreview | null, rawUrl: string) => void;
  disabled?: boolean;
}

type Phase = 'idle' | 'loading' | 'ready';

export const LeetcodeImportPanel: React.FC<LeetcodeImportPanelProps> = ({ onApply, disabled = false }) => {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<LeetcodeImportPreview | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const isLoading = phase === 'loading';

  const handleFetch = async () => {
    if (isLoading || disabled) return;

    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError('Paste a LeetCode problem URL to import.');
      return;
    }
    if (!looksLikeLeetcodeProblemUrl(trimmed)) {
      setUrlError('Enter a valid LeetCode problem URL, for example https://leetcode.com/problems/two-sum/');
      return;
    }

    setUrlError(null);
    setRequestError(null);
    setPreview(null);
    setPhase('loading');

    try {
      const result = await importLeetcodeProblem(trimmed);
      setPreview(result);
      setPhase('ready');
    } catch (err: unknown) {
      setRequestError(
        getErrorMessage(
          err,
          "Couldn't import this problem automatically. You can enter the problem details manually."
        )
      );
      setPhase('ready');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // The input lives inside the Add Problem <form>; never submit the problem form from here.
      event.preventDefault();
      void handleFetch();
    }
  };

  const handleManualFallback = () => onApply(preview, url);

  const hasPreview = Boolean(preview) && preview!.status !== 'UNAVAILABLE';

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <span className={styles.introIcon} aria-hidden="true">
          <Sparkles size={16} />
        </span>
        <p className={styles.introText}>
          Paste a LeetCode problem link to fill in the title, difficulty and link automatically. You
          review and edit everything before saving.
        </p>
      </div>

      <Field
        label="LeetCode problem URL"
        hint="Paste a link like https://leetcode.com/problems/two-sum/"
        error={urlError ?? undefined}
        required
      >
        <div className={styles.urlRow}>
          <Input
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://leetcode.com/problems/two-sum/"
            value={url}
            disabled={isLoading || disabled}
            onChange={(event) => {
              setUrl(event.target.value);
              if (urlError) setUrlError(null);
            }}
            onKeyDown={handleKeyDown}
          />
          <Button
            onClick={() => void handleFetch()}
            loading={isLoading}
            loadingLabel="Fetching..."
            disabled={disabled}
            className={styles.fetchButton}
          >
            Fetch details
          </Button>
        </div>
      </Field>

      {requestError ? (
        <Alert
          tone="warning"
          title="Automatic import unavailable"
          action={
            <div className={styles.alertActions}>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<RefreshCw size={14} />}
                onClick={() => void handleFetch()}
              >
                Try again
              </Button>
              <Button variant="ghost" size="sm" onClick={handleManualFallback}>
                Enter details manually
              </Button>
            </div>
          }
        >
          {requestError}
        </Alert>
      ) : null}

      {preview && preview.status === 'UNAVAILABLE' ? (
        <Alert
          tone="warning"
          title="Couldn't import this problem automatically"
          action={
            <Button variant="secondary" size="sm" onClick={handleManualFallback}>
              Enter details manually
            </Button>
          }
        >
          {preview.message ??
            "Couldn't import this problem automatically. You can enter the problem details manually."}
        </Alert>
      ) : null}

      {hasPreview ? (
        <section className={styles.preview} aria-label="Imported problem preview">
          <header className={styles.previewHeader}>
            <h3 className={styles.previewTitle}>Imported preview</h3>
            <Badge tone={preview!.status === 'IMPORTED' ? 'success' : 'warning'}>
              {preview!.status === 'IMPORTED' ? 'Imported' : 'Partly imported'}
            </Badge>
          </header>

          <dl className={styles.previewGrid}>
            <div className={styles.previewItem}>
              <dt className={styles.term}>Title</dt>
              <dd className={styles.value}>{preview!.title ?? 'Not available'}</dd>
            </div>
            <div className={styles.previewItem}>
              <dt className={styles.term}>Difficulty</dt>
              <dd className={styles.value}>{preview!.difficulty ?? 'Not available'}</dd>
            </div>
            <div className={styles.previewItem}>
              <dt className={styles.term}>Source</dt>
              <dd className={styles.value}>LeetCode</dd>
            </div>
            <div className={styles.previewItem}>
              <dt className={styles.term}>URL</dt>
              <dd className={styles.value}>
                <a
                  className={styles.url}
                  href={preview!.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {preview!.url}
                  <ExternalLink size={12} aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </dd>
            </div>
          </dl>

          {preview!.status === 'PARTIAL' && preview!.message ? (
            <p className={styles.previewNote}>{preview!.message}</p>
          ) : null}

          {preview!.duplicate ? (
            <Alert tone="warning" title="This problem is already in your tracker">
              <p>
                #{preview!.duplicate.sNo} {preview!.duplicate.title} is already saved in your{' '}
                {preview!.duplicate.section === 'COLLEGE' ? 'College' : 'Personal'} tracker.
              </p>
              <Link className={styles.url} to={`/problems/${preview!.duplicate.id}`}>
                Open the existing problem
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </Alert>
          ) : null}

          <div className={styles.previewActions}>
            <p className={styles.previewHint}>You can edit every field on the next step before saving.</p>
            <Button
              iconRight={<ArrowRight size={16} />}
              onClick={() => onApply(preview, url)}
              disabled={disabled}
            >
              Use these details
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
};
