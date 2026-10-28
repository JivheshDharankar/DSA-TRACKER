import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from './cx';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useScrollLock } from '../../hooks/useScrollLock';
import styles from './Dialog.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Dialog` — the accessible overlay foundation for every future modal.
 *
 * Accessibility
 *   - rendered in a portal on `document.body`;
 *   - `role="dialog"` + `aria-modal="true"`, labelled by the title and described by
 *     the description through generated ids;
 *   - focus moves in on open (`initialFocusRef`, else the close button), is trapped
 *     while open, and returns to the previously focused element on close;
 *   - Escape closes (handled by the focus trap) and the body does not scroll behind
 *     the overlay.
 *
 * Responsive: below the `sm` breakpoint (640px) the panel becomes a bottom sheet —
 * full-width, anchored to the bottom, rounded on the top corners only, with a drag
 * affordance and safe-area padding. Set `bottomSheet={false}` to opt out.
 *
 * Existing modals (`ProblemModal`, `RecallSessionModal`, `DeleteProblemDialog`) are
 * NOT migrated in this phase.
 */

export type DialogSize = 'sm' | 'md' | 'lg';

export interface DialogProps {
  open: boolean;
  /** Called on Escape, backdrop click and the close button. */
  onClose: () => void;
  /** Dialog heading. Required — it is the dialog's accessible name. */
  title: React.ReactNode;
  /** Optional supporting text, wired to `aria-describedby`. */
  description?: React.ReactNode;
  /** `sm` 420px · `md` 560px · `lg` 720px. */
  size?: DialogSize;
  /** Allow the mobile bottom-sheet treatment below 640px. Default `true`. */
  bottomSheet?: boolean;
  /** Close when the backdrop is clicked. Default `true`. */
  closeOnBackdropClick?: boolean;
  /** Render the header close button. Default `true`. */
  showCloseButton?: boolean;
  /** Element focused when the dialog opens; defaults to the close button. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  className?: string;
  children: React.ReactNode;
  /** Actions rendered in the dialog footer. */
  footer?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  size = 'md',
  bottomSheet = true,
  closeOnBackdropClick = true,
  showCloseButton = true,
  initialFocusRef,
  className,
  children,
  footer,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useFocusTrap({ active: open, containerRef: panelRef, initialFocusRef, onEscape: onClose });
  useScrollLock(open);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div className={styles.overlay} onMouseDown={handleBackdropMouseDown}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(styles.panel, styles[size], bottomSheet && styles.bottomSheet, className)}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 className={styles.title} id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className={styles.description} id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>

          {showCloseButton ? (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close dialog">
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <div className={styles.body}>{children}</div>

        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
};
