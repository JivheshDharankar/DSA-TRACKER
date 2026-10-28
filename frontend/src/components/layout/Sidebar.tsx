import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Layers, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MEDIA } from '../../styles/breakpoints';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { NAV_GROUPS } from './nav.config';
import styles from './Sidebar.module.css';

/**
 * DSA Tracker — App shell navigation (Phase 3)
 * ============================================
 * Desktop sidebar (>=1024px, `--layout-sidebar` 240px) and tablet icon rail
 * (768–1023px, `--layout-rail` 64px). Below 768px the whole element is removed from the
 * layout by `Sidebar.module.css` and replaced by the mobile topbar + bottom bar.
 *
 * Destinations, labels and grouping come from `nav.config.ts`. `NavLink` keeps its
 * default matching (no `end`, no custom matcher), so the pre-Phase-3 active-route
 * semantics are preserved exactly. The only change to a link is its styling.
 *
 * Logout behaviour is unchanged: `await logout()` then `navigate('/login')`.
 */

export const Sidebar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  /** Rail mode also decides props that cannot be expressed in CSS (icon-only logout
   *  button, tooltips), using the same breakpoint the stylesheet uses. */
  const isRail = useMediaQuery(MEDIA.tablet);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const groups = NAV_GROUPS.map((group) => ({
    heading: group.heading,
    // Protected destinations are always listed (unchanged behaviour); the guest-only
    // Account group appears only while signed out.
    items: group.items.filter((item) => item.requiresAuth || !isAuthenticated),
  })).filter((group) => group.items.length > 0);

  const accountLabel = user ? user.name || user.email : '';

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>
          <Layers size={18} aria-hidden="true" />
        </span>
        <span className={styles.brandName}>DSA Tracker</span>
      </div>

      <nav className={styles.nav} aria-label="Primary">
        {groups.map((group) => (
          <div key={group.heading ?? 'primary'} className={styles.group}>
            {group.heading ? <p className={styles.groupHeading}>{group.heading}</p> : null}

            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  /* Tooltip only where the label is visually hidden (tablet rail). */
                  title={isRail ? item.label : undefined}
                  className={({ isActive }) => cx(styles.navLink, isActive && styles.navLinkActive)}
                >
                  <span className={styles.navIcon}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className={styles.navLabel}>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {isAuthenticated && user ? (
        <div className={styles.footer}>
          <div className={styles.userBlock}>
            <span className={styles.userAvatar} aria-hidden="true">
              {accountLabel.charAt(0).toUpperCase()}
            </span>
            <span className={styles.userMeta}>
              <span className={styles.userName} title={user.email}>
                {accountLabel}
              </span>
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            fullWidth={!isRail}
            iconOnly={isRail}
            aria-label={isRail ? 'Sign Out' : undefined}
            title="Sign Out of session"
            onClick={handleLogout}
            iconLeft={<LogOut size={14} aria-hidden="true" />}
          >
            {isRail ? null : 'Sign Out'}
          </Button>
        </div>
      ) : null}
    </aside>
  );
};
