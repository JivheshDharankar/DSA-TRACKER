import React, { useState, useEffect } from 'react';
import { X, Search, Sparkles, Check, Loader2 } from 'lucide-react';
import { fetchPatterns } from '../../api/patterns.api';
import {
  PatternWithMastery,
  ProblemPatternAttachment,
  PatternConfidence,
} from '../../types';
import styles from './PatternPickerModal.module.css';

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
  onSave: (patterns: Array<{ patternId: string; confidence: PatternConfidence; isPrimary: boolean }>) => Promise<void>;
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

  if (!isOpen) return null;

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
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            <Sparkles size={20} color="var(--accent-cyan)" />
            <span>Assign Patterns — {problemTitle}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.searchBar}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search 30 algorithmic patterns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.patternList}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader2 size={24} className="animate-spin" color="var(--accent-cyan)" />
            </div>
          ) : (
            filteredPatterns.map((p) => {
              const isSelected = selections.has(p.id);
              const selection = selections.get(p.id);

              return (
                <div
                  key={p.id}
                  className={`${styles.patternItem} ${isSelected ? styles.patternItemSelected : ''}`}
                >
                  <div className={styles.itemLeft}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={isSelected}
                      onChange={() => handleTogglePattern(p.id)}
                      id={`pattern-${p.id}`}
                    />
                    <div>
                      <label
                        htmlFor={`pattern-${p.id}`}
                        className={styles.patternName}
                        style={{ cursor: 'pointer' }}
                      >
                        {p.name}
                      </label>
                      <div className={styles.patternMeta}>
                        <span>{p.prerequisites.slice(0, 2).join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  {isSelected && selection && (
                    <div className={styles.itemRight}>
                      <select
                        className={styles.confidenceSelect}
                        value={selection.confidence}
                        onChange={(e) =>
                          handleChangeConfidence(p.id, e.target.value as PatternConfidence)
                        }
                      >
                        <option value="LOW">Low Conf.</option>
                        <option value="MEDIUM">Med Conf.</option>
                        <option value="HIGH">High Conf.</option>
                      </select>

                      <label className={styles.primaryLabel}>
                        <input
                          type="checkbox"
                          checked={selection.isPrimary}
                          onChange={() => handleTogglePrimary(p.id)}
                        />
                        <span>Primary</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Save Patterns ({selections.size})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
