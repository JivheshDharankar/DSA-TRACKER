import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Problem } from '../../types';
import styles from './DeleteProblemDialog.module.css';

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

  if (!isOpen || !problem) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete(problem.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.warningIconWrapper}>
          <AlertTriangle size={26} />
        </div>

        <h3 className={styles.title}>Delete Problem #{problem.sNo}?</h3>
        <p className={styles.description}>
          Are you sure you want to permanently delete{' '}
          <strong style={{ color: 'var(--text-main)' }}>&ldquo;{problem.title}&rdquo;</strong>?
          This action is irreversible.
        </p>

        <div className={styles.gapNotice}>
          💡 <strong>S.No Preservation:</strong> Deleting this problem will leave a permanent gap in
          numbering at S.No #{problem.sNo}. Remaining problems will not be renumbered.
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={styles.cancelBtn}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className={styles.deleteBtn}
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Permanently</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
