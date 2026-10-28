import React, { createContext, useContext, useId, useRef } from 'react';
import { cx } from './cx';
import styles from './Tabs.module.css';

/**
 * DSA Tracker — UI primitive layer (Phase 2)
 * =========================================
 * `Tabs` / `TabList` / `Tab` / `TabPanel` — a controlled, accessible tab set.
 *
 * Behaviour
 *   - `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected`,
 *     `aria-controls` and `aria-labelledby` wired automatically;
 *   - roving `tabIndex` (only the selected tab is tabbable) with ArrowLeft /
 *     ArrowRight / Home / End moving between tabs, wrapping at both ends;
 *   - inactive panels are not rendered at all, so their content stays out of the
 *     accessibility tree.
 *
 * Controlled by design: `value` + `onChange`, matching the existing filter state style
 * in the app. `label` is required because a tablist needs an accessible name.
 */

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  label: string;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = (component: string): TabsContextValue => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be rendered inside <Tabs>.`);
  }
  return context;
};

/** Ids are built from `useId` plus the tab value; keep them selector-safe. */
const toIdPart = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '-');

export interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the tablist, e.g. "Problem views". */
  label: string;
  className?: string;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ value, onChange, label, className, children }) => {
  const baseId = useId();

  return (
    <TabsContext.Provider value={{ value, setValue: onChange, label, baseId }}>
      <div className={cx(styles.tabs, className)}>{children}</div>
    </TabsContext.Provider>
  );
};

export interface TabListProps {
  className?: string;
  children: React.ReactNode;
}

export const TabList: React.FC<TabListProps> = ({ className, children }) => {
  const { label } = useTabsContext('TabList');
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) {
      return;
    }

    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? []
    );
    if (tabs.length === 0) {
      return;
    }

    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      default:
        nextIndex = tabs.length - 1;
        break;
    }

    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  };

  return (
    <div role="tablist" aria-label={label} className={cx(styles.list, className)} ref={listRef} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
};

export interface TabProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Tab: React.FC<TabProps> = ({ value, disabled = false, className, children }) => {
  const { value: activeValue, setValue, baseId } = useTabsContext('Tab');
  const selected = activeValue === value;
  const idPart = toIdPart(value);

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${idPart}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${idPart}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      className={cx(styles.tab, selected && styles.tabActive, className)}
      onClick={() => setValue(value)}
    >
      {children}
      <span className={styles.indicator} aria-hidden="true" />
    </button>
  );
};

export interface TabPanelProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export const TabPanel: React.FC<TabPanelProps> = ({ value, className, children }) => {
  const { value: activeValue, baseId } = useTabsContext('TabPanel');
  if (activeValue !== value) {
    return null;
  }

  const idPart = toIdPart(value);

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${idPart}`}
      aria-labelledby={`${baseId}-tab-${idPart}`}
      tabIndex={0}
      className={cx(styles.panel, className)}
    >
      {children}
    </div>
  );
};
