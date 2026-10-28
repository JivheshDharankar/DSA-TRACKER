import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Check, Loader2 } from 'lucide-react';
import { fetchPatterns } from '../../api/patterns.api';
import { PatternWithMastery, ProblemPatternAttachment, PatternConfidence } from '../../types';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { cx } from '../ui/cx';
import styles from './PatternPickerModal.module.css';

/**
 * DSA Tracker — pattern assignment dialog (Phase 9)
 * =================================================
 * The picker now renders inside the shared `Dialog`: portal, accessible name and
 * description, focus trap, Escape, scroll lock and focus restoration come from that
 * primitive. This module owns the search field, the pattern list and the per-pattern
 * confidence/primary controls.
 *
 * Behaviour is unchanged: the same catalog fetch, the same selection map, the first
 * selected pattern becoming primary, single-primary enforcement, and the same
 * `onSave` payload (`{ patternId, confidence, isPrimary }[]`) followed by `onClose()`.
 *
 * Empty states: the list distinguishes "no patterns in the catalog yet" from "nothing
 * matches this search", and the latter offers a one-click clear action. The list
 * scrolls inside the dialog so the footer actions stay reachable on small screens.
 */

interface PatternSelectionState {
  patternId: string;
  confidence: PatternConfidence;
  isPrimary: boolean;
}

interface PatternPickerModalProps {
  isOpen: boolean;
  problemTitle: string;
  currentAttachments: ProblemPatternAttachment[];
  onClose: () => void;
  onSave: (
    patterns: Array<{ patternId: string; confidence: PatternConfidence; isPrimary: boolean }>
  ) => Promise<void>;
}

export const PatternPickerModal: React.FC<PatternPickerModalProps> = ({
  isOpen,
  problemTitle,
  currentAttachments,
  onClose,
  onSave,
}) => {
  const [allPatterns, setAllPatterns] = useState<PatternWithMastery[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selections, setSelections] = useState<Map<string, PatternSelectionState>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAllPatterns();
      // Initialize selections map from current attachments
      const initialMap = new Map<string, PatternSelectionState>();
      for (const att of currentAttachments) {
        const patId = att.pattern?.id || (att as unknown as { patternId: string }).patternId;
        if (patId) {
          initialMap.set(patId, {
            patternId: patId,
            confidence: att.confidence || 'MEDIUM',
            isPrimary: att.isPrimary || false,
          });
        }
      }
      setSelections(initialMap);
      setSearchQuery('');
    }
  }, [isOpen, currentAttachments]);

  const loadAllPatterns = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPatterns();
      setAllPatterns(data);
    } catch (err) {
      console.error('Failed to load patterns:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePattern = (patternId: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.has(patternId)) {
        next.delete(patternId);
      } else {
        next.set(patternId, {
          patternId,
          confidence: 'MEDIUM',
          isPrimary: next.size === 0, // First selected pattern defaults to primary
        });
      }
      return next;
    });
  };

  const handleChangeConfidence = (patternId: string, confidence: PatternConfidence) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(patternId);
      if (current) {
        next.set(patternId, { ...current, confidence });
      }
      return next;
    });
  };

  const handleTogglePrimary = (patternId: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(patternId);
      if (current) {
        // If turning on primary, turn off on others
        const newPrimary = !current.isPrimary;
        if (newPrimary) {
          for (const [k, v] of next.entries()) {
            next.set(k, { ...v, isPrimary: false });
          }
        }
        next.set(patternId, { ...current, isPrimary: newPrimary });
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const list = Array.from(selections.values());
      await onSave(list);
      onClose();
    } catch (err) {
      console.error('Failed to save pattern associations:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPatterns = allPatterns.filter(
    (p) =>
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Assign Patterns"
      description={problemTitle}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            loadingLabel="Saving..."
            iconLeft={<Check size={16} />}
          >
            Save Patterns ({selections.size})
          </Button>
        </>
      }
    >
      <div className={styles.content}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <Input
            aria-label="Search patterns"
            placeholder="Search patterns by name or prerequisite..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.toolbar}>
          <span className={styles.count}>
            {filteredPatterns.length} of {allPatterns.length} patterns
          </span>
          {selections.size > 0 ? (
            <Badge tone="accent">
              <span role="status">{selections.size} selected</span>
            </Badge>
          ) : (
            <span className={styles.hint}>Select every pattern this problem applies</span>
          )}
        </div>

        <div className={styles.list} role="group" aria-label="Available patterns">
          {isLoading ? (
            <div className={styles.loading} role="status">
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              <span>Loading patterns…</span>
            </div>
          ) : filteredPatterns.length === 0 ? (
            <EmptyState
              variant="compact"
              icon={allPatterns.length === 0 ? <Sparkles size={20} /> : <Search size={20} />}
              title={allPatterns.length === 0 ? 'No patterns available' : 'No matching patterns'}
              description={
                allPatterns.length === 0
                  ? 'There are no patterns in the catalog yet, so nothing can be attached.'
                  : `Nothing matches “${searchQuery.trim()}”. Try a shorter search.`
              }
              primaryAction={
                allPatterns.length > 0 ? (
                  <Button size="sm" variant="secondary" onClick={() => setSearchQuery('')}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          ) : (
            filteredPatterns.map((p) => {
              const isSelected = selections.has(p.id);
              const selection = selections.get(p.id);

              return (
                <div key={p.id} className={cx(styles.row, isSelected && styles.rowSelected)}>
                  <div className={styles.rowMain}>
                    <input
                      id={`pattern-${p.id}`}
                      type="checkbox"
                      className={styles.checkbox}
                      checked={isSelected}
                      onChange={() => handleTogglePattern(p.id)}
                    />

                    <div className={styles.rowText}>
                      <label htmlFor={`pattern-${p.id}`} className={styles.name}>
                        {p.name}
                      </label>
                      <p className={styles.meta}>
                        {p.prerequisites.length > 0
                          ? p.prerequisites.slice(0, 2).join(' · ')
                          : p.description}
                      </p>
                    </div>
                  </div>

                  {isSelected && selection ? (
                    <div className={styles.rowControls}>
                      <Select
                        size="compact"
                        className={styles.confidence}
                        aria-label={`Confidence for ${p.name}`}
                        value={selection.confidence}
                        onChange={(e) =>
                          handleChangeConfidence(p.id, e.target.value as PatternConfidence)
                        }
                      >
                        <option value="LOW">Low Conf.</option>
                        <option value="MEDIUM">Med Conf.</option>
                        <option value="HIGH">High Conf.</option>
                      </Select>

                      <label className={styles.primaryLabel}>
                        <input
                          type="checkbox"
                          checked={selection.isPrimary}
                          onChange={() => handleTogglePrimary(p.id)}
                        />
                        <span>Primary</span>
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
};
