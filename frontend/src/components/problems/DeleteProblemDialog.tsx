import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Problem } from '../../types';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import styles from './DeleteProblemDialog.module.css';

/**
 * DSA Tracker — delete confirmation (Phase 9)
 * ===========================================
 * A destructive confirmation on the shared `Dialog`: the question is the dialog's
 * accessible name, the irreversible warning is its description, and the two actions
 * are the shared `Button` primitive (`secondary` cancel, `danger` confirm).
 *
 * Behaviour is unchanged: `onConfirmDelete(problemId)` is awaited, the dialog closes
 * only after it resolves, both buttons are disabled while it is in flight, and the
 * S.No preservation notice stays visible so the consequence is explicit.
 */

interface DeleteProblemDialogProps {
  isOpen: boolean;
  problem: Problem | null;
  onClose: () => void;
  onConfirmDelete: (problemId: string) => Promise<void>;
}

export const DeleteProblemDialog: React.FC<DeleteProblemDialogProps> = ({
  isOpen,
  problem,
  onClose,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!problem) return;

    setIsDeleting(true);
    try {
      await onConfirmDelete(problem.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={isOpen && Boolean(problem)}
      onClose={onClose}
      title={problem ? `Delete Problem #${problem.sNo}?` : 'Delete problem'}
      description={
        problem ? (
          <>
            This permanently removes <strong className={styles.problemTitle}>&ldquo;{problem.title}&rdquo;</strong>{' '}
            from your tracker. This action is irreversible.
          </>
        ) : undefined
      }
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={isDeleting}
            loadingLabel="Deleting..."
          >
            Delete Permanently
          </Button>
        </>
      }
    >
      <div className={styles.notice}>
        <span className={styles.noticeIcon} aria-hidden="true">
          <Info size={16} />
        </span>
        <p className={styles.noticeText}>
          <strong className={styles.noticeTitle}>S.No Preservation:</strong> Deleting this problem will
          leave a permanent gap in numbering at S.No #{problem?.sNo}. Remaining problems will not be
          renumbered.
        </p>
      </div>
    </Dialog>
  );
};
