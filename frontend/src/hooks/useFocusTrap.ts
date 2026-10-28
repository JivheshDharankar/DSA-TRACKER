import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Focus management for overlay surfaces (Dialog today, the navigation drawer in a
 * later phase).
 *
 * While `active`:
 *   - focus moves into the container (explicit `initialFocusRef`, else first
 *     focusable descendant, else the container itself);
 *   - Tab / Shift+Tab cycle inside the container, wrapping at both ends;
 *   - focus that escapes the container (a `focusin` outside it — including a Tab
 *     dispatched before the effect has attached, i.e. during the opening
 *     transition) is pulled straight back into the container;
 *   - Escape calls `onEscape`;
 *   - on deactivate, focus returns to whatever was focused before.
 *
 * Only elements that actually render are considered focusable
 * (`getClientRects().length > 0`), so hidden inputs are skipped.
 *
 * Nested overlays: traps form a stack and only the innermost active trap owns the
 * keyboard and the `focusin` guard, so a dialog opened from another dialog does not
 * fight its parent for focus.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface TrapRecord {
  container: HTMLElement;
}

/** Active traps, outermost first. Only the last entry handles Tab and focus recapture. */
const trapStack: TrapRecord[] = [];

export interface UseFocusTrapOptions {
  /** Whether the trap is currently engaged. */
  active: boolean;
  /** Ref to the container that owns focus while active. */
  containerRef: RefObject<HTMLElement>;
  /** Optional element to focus first instead of the first focusable descendant. */
  initialFocusRef?: RefObject<HTMLElement>;
  /** Called when Escape is pressed inside the container. */
  onEscape?: () => void;
  /** Return focus to the previously focused element on deactivate. Default `true`. */
  restoreFocus?: boolean;
}

export const useFocusTrap = ({
  active,
  containerRef,
  initialFocusRef,
  onEscape,
  restoreFocus = true,
}: UseFocusTrapOptions): void => {
  // Latest-value refs: callers pass inline arrow functions, and putting them in the
  // dependency list would re-run the effect on every render — which would move focus
  // back to the first control while the user is typing.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!active || typeof document === 'undefined') {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const trap: TrapRecord = { container };
    trapStack.push(trap);

    const isTopmost = () => trapStack[trapStack.length - 1] === trap;

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getClientRects().length > 0
      );

    const activeElement = (): HTMLElement | null =>
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const isInside = (element: Element | null): boolean =>
      element instanceof Element && container.contains(element);

    /** Whether this trap added the container's `tabindex`, so cleanup can remove it. */
    let addedTabIndex = false;

    /** Focus the container itself, giving it a temporary tabindex when it has none. */
    const focusContainer = (): void => {
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
        addedTabIndex = true;
      }
      container.focus({ preventScroll: true });
    };

    const focusFirst = (): void => {
      const target = initialFocusRef?.current ?? getFocusable()[0] ?? container;
      if (target === container) {
        focusContainer();
        return;
      }
      target.focus({ preventScroll: true });
    };

    /** First element in tab order — used for the Tab wraparound, ignoring `initialFocusRef`. */
    const focusFirstInOrder = (): void => {
      const target = getFocusable()[0];
      if (target) {
        target.focus({ preventScroll: true });
      } else {
        focusContainer();
      }
    };

    const focusLast = (): void => {
      const focusable = getFocusable();
      const target = focusable[focusable.length - 1];
      if (target) {
        target.focus({ preventScroll: true });
      } else {
        focusContainer();
      }
    };

    focusFirst();

    /**
     * Pull focus back into the container when something else took it. Called from the
     * `focusin` guard and once on the next frame, which covers a Tab pressed while the
     * overlay is still mounting and before the listeners were attached.
     */
    const recapture = (): void => {
      if (!isTopmost() || !container.isConnected) {
        return;
      }
      if (isInside(activeElement())) {
        return;
      }
      const focusable = getFocusable();
      if (focusable.length > 0) {
        focusable[0].focus({ preventScroll: true });
      } else {
        focusContainer();
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isTopmost()) {
        return;
      }

      if (event.key === 'Escape') {
        if (onEscapeRef.current) {
          event.stopPropagation();
          onEscapeRef.current();
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        focusContainer();
        return;
      }

      const current = activeElement();
      const index = current && isInside(current) ? focusable.indexOf(current) : -1;

      // Always move focus ourselves: the browser's default order can step outside the
      // container when the active element is the panel itself or a non-tabbable node.
      event.preventDefault();

      if (event.shiftKey) {
        if (index <= 0) {
          focusLast();
        } else {
          focusable[index - 1].focus({ preventScroll: true });
        }
        return;
      }

      if (index === -1 || index === focusable.length - 1) {
        focusFirstInOrder();
      } else {
        focusable[index + 1].focus({ preventScroll: true });
      }
    };

    const handleFocusIn = (event: FocusEvent): void => {
      if (!isTopmost()) {
        return;
      }
      if (isInside(event.target as Element | null)) {
        return;
      }
      recapture();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);

    const settleFrame =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => {
            recapture();
          })
        : null;
    const settleTimer =
      settleFrame === null && typeof window !== 'undefined'
        ? window.setTimeout(recapture, 0)
        : null;

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);

      if (settleFrame !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(settleFrame);
      }
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }

      const index = trapStack.lastIndexOf(trap);
      if (index !== -1) {
        trapStack.splice(index, 1);
      }

      if (addedTabIndex) {
        container.removeAttribute('tabindex');
      }

      if (restoreFocus && previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, initialFocusRef, restoreFocus]);
};
