import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cx } from '../ui/cx';
import { MOBILE_TABS, isMoreTabActive } from './nav.config';
import styles from './BottomNav.module.css';

/**
 * DSA Tracker — Mobile bottom navigation (Phase 3)
 * ===============================================
 * Rendered only below 768px. Five destinations: the four primary tabs from
 * `nav.config.ts` (`mobile: 'tab'`) plus "More", which opens the drawer holding the
 * secondary destinations.
 *
 * Active state: `NavLink` keeps its default matching (no `end`, no custom matcher), so
 * `/patterns`-style prefix behaviour is identical to the sidebar. "More" is a button,
 * not a link — its active state comes from `isMoreTabActive`, which covers the
 * authenticated secondary destinations and deliberately keeps "More" inactive on
 * `/login` and `/register` even while the drawer is open.
 *
 * Touch targets are at least `--layout-touch-target` (44px) inside the 56px bar, which
 * also carries the safe-area inset.
 */

export interface BottomNavProps {
  /** Whether the "More" drawer is currently open. */
  isMoreOpen: boolean;
  onOpenMore: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ isMoreOpen, onOpenMore }) => {
  const location = useLocation();
  const isMoreActive = isMoreTabActive(location.pathname, isMoreOpen);

  return (
    <nav className={styles.bottomNav} aria-label="Primary">
      {MOBILE_TABS.map((destination) => {
        const Icon = destination.icon;
        return (
          <NavLink
            key={destination.to}
            to={destination.to}
            className={({ isActive }) => cx(styles.tab, isActive && styles.tabActive)}
          >
            <Icon size={20} aria-hidden="true" />
            <span className={styles.tabLabel}>{destination.tabLabel ?? destination.label}</span>
          </NavLink>
        );
      })}

      <button
        type="button"
        className={cx(styles.tab, isMoreActive && styles.tabActive)}
        onClick={onOpenMore}
        aria-haspopup="dialog"
        aria-expanded={isMoreOpen}
      >
        <Menu size={20} aria-hidden="true" />
        <span className={styles.tabLabel}>More</span>
      </button>
    </nav>
  );
};
