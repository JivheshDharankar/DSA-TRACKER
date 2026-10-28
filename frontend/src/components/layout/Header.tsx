import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layers, RefreshCw, LogOut, User as UserIcon } from 'lucide-react';
import { checkApiHealth } from '../../api/health.api';
import { HealthCheckData } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { getRouteTitle } from './nav.config';
import styles from './Header.module.css';

/**
 * DSA Tracker — Topbar (Phase 3)
 * =============================
 * Holds the page heading (`<h1>`), the API-health indicator and the account actions.
 *
 * The heading text comes from `nav.config.ts` (`getRouteTitle`): an exact path match
 * first, then the parent destination's title, then the `DSA Tracker` fallback — so
 * `/patterns/:id` reads "Patterns" instead of the app name.
 *
 * Unchanged behaviour: the 30s health poll and its three states, the guest "Sign In"
 * action (still suppressed on `/login` and `/register`), and logout
 * (`await logout()` then `navigate('/login')`).
 *
 * The heading stays an `<h1>` — an `<h2>` here would collide with the end-to-end
 * suite's single level-2 heading assertion.
 */

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const [health, setHealth] = useState<HealthCheckData | null>(null);
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const fetchHealth = async () => {
    setIsRefreshing(true);
    try {
      const data = await checkApiHealth();
      setHealth(data);
      setStatus('connected');
    } catch {
      setStatus('disconnected');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const pageTitle = getRouteTitle(location.pathname);
  const statusText = status === 'connected' ? 'API Online' : status === 'checking' ? 'Checking API...' : 'API Offline';
  const statusTone =
    status === 'connected' ? styles.statusConnected : status === 'checking' ? styles.statusChecking : styles.statusDisconnected;

  return (
    <header className={styles.header}>
      {/* Mobile only: the sidebar (which owns the brand from 768px up) is not rendered. */}
      <div className={styles.brand}>
        <span className={styles.brandIcon}>
          <Layers size={16} aria-hidden="true" />
        </span>
      </div>

      <div className={styles.titleArea}>
        <h1 className={styles.title}>{pageTitle}</h1>
      </div>

      <div className={styles.actions}>
        <div className={styles.statusPill}>
          <span className={cx(styles.statusDot, statusTone)} aria-hidden="true" />
          <span>{statusText}</span>
          {status === 'connected' ? (
            <span className={styles.statusDetail}>
              ({health?.database.connected ? 'DB Connected' : 'DB Offline'})
            </span>
          ) : null}
          <button
            type="button"
            onClick={fetchHealth}
            className={styles.refreshBtn}
            title="Refresh API Health"
            disabled={isRefreshing}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>

        {isAuthenticated && user ? (
          <div className={styles.userPill}>
            <span className={styles.userAvatar} aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className={styles.userName}>{user.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Log out of session"
              iconLeft={<LogOut size={15} aria-hidden="true" />}
            >
              Sign Out
            </Button>
          </div>
        ) : null}

        {!isAuthenticated && location.pathname !== '/login' && location.pathname !== '/register' ? (
          <Button
            variant="primary"
            size="sm"
            className={styles.signInAction}
            onClick={() => navigate('/login')}
            iconLeft={<UserIcon size={15} aria-hidden="true" />}
          >
            Sign In
          </Button>
        ) : null}
      </div>
    </header>
  );
};
