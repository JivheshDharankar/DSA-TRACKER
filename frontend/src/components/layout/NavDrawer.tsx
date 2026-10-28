import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { Dialog } from '../ui/Dialog';
import { MOBILE_SECONDARY } from './nav.config';
import styles from './NavDrawer.module.css';

/**
 * DSA Tracker — Mobile "More" drawer (Phase 3)
 * ===========================================
 * Secondary navigation for the mobile shell, presented with the Phase 2 `Dialog`:
 * portal, backdrop, focus trap, initial focus, focus restoration, Escape to close,
 * `aria-modal` and body scroll lock all come from that primitive — nothing is
 * re-implemented here, and `useFocusTrap` / `useScrollLock` are not called directly
 * (the Dialog already owns them).
 *
 * Below 640px the Dialog presents as a bottom sheet; from 640–767px it is a centred
 * panel. Playing it safe for the end-to-end suite, the Dialog renders nothing while
 * `open` is false, so there is never a second "Sign Out" button in the DOM at rest.
 *
 * Every link closes the drawer on activation, and logout keeps the existing behaviour:
 * `await logout()` then `navigate('/login')`.
 */

export interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const NavDrawer: React.FC<NavDrawerProps> = ({ open, onClose }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  const destinations = MOBILE_SECONDARY.filter((destination) => destination.requiresAuth || !isAuthenticated);
  const accountLabel = user ? user.name || user.email : '';

  return (
    <Dialog open={open} onClose={onClose} title="More" size="sm">
      <nav className={styles.list} aria-label="More destinations">
        {destinations.map((destination) => {
          const Icon = destination.icon;
          return (
            <NavLink
              key={destination.to}
              to={destination.to}
              onClick={onClose}
              className={({ isActive }) => cx(styles.row, isActive && styles.rowActive)}
            >
              <span className={styles.rowIcon}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className={styles.rowLabel}>{destination.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {isAuthenticated && user ? (
        <div className={styles.account}>
          <div className={styles.accountUser}>
            <span className={styles.accountAvatar} aria-hidden="true">
              {accountLabel.charAt(0).toUpperCase()}
            </span>
            <span className={styles.accountMeta}>
              <span className={styles.accountName}>{accountLabel}</span>
              <span className={styles.accountEmail}>{user.email}</span>
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={handleLogout}
            iconLeft={<LogOut size={15} aria-hidden="true" />}
          >
            Sign Out
          </Button>
        </div>
      ) : null}
    </Dialog>
  );
};
