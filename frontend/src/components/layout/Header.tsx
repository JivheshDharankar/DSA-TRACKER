import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw, LogOut, User as UserIcon, Sun, Moon } from 'lucide-react';
import { checkApiHealth } from '../../api/health.api';
import { HealthCheckData } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import styles from './Header.module.css';

const routeTitleMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/college-dsa': 'College DSA Tracker',
  '/personal-dsa': 'Personal DSA Tracker',
  '/review': 'Review Queue',
  '/reviews/history': 'Review History',
  '/patterns': 'Patterns',
  '/problems/locked': 'Locked Problems',
  '/login': 'Sign In',
  '/register': 'Create Account',
};

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

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

  const pageTitle = routeTitleMap[location.pathname] || 'DSA Tracker';

  return (
    <header className={styles.header}>
      <div className={styles.titleArea}>
        <h1 className={styles.title}>{pageTitle}</h1>
      </div>

      <div className={styles.actionsArea}>
        <button
          onClick={toggleTheme}
          className={styles.themeToggleBtn}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={15} className={styles.themeIconSun} />
              <span className={styles.themeLabel}>Light</span>
            </>
          ) : (
            <>
              <Moon size={15} className={styles.themeIconMoon} />
              <span className={styles.themeLabel}>Dark</span>
            </>
          )}
        </button>

        <div className={styles.statusPill}>
          <span
            className={`${styles.statusDot} ${
              status === 'connected'
                ? styles.statusConnected
                : status === 'checking'
                ? styles.statusChecking
                : styles.statusDisconnected
            }`}
          />
          <span>
            {status === 'connected'
              ? `API Online (${health?.database.connected ? 'DB Connected' : 'DB Offline'})`
              : status === 'checking'
              ? 'Checking API...'
              : 'API Offline'}
          </span>
          <button
            onClick={fetchHealth}
            className={styles.refreshBtn}
            title="Refresh API Health"
            disabled={isRefreshing}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {isAuthenticated && user && (
          <div className={styles.userProfilePill}>
            <div className={styles.userAvatar}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className={styles.userName}>{user.name}</span>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={styles.logoutBtn}
              title="Log out of session"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {!isAuthenticated && location.pathname !== '/login' && location.pathname !== '/register' && (
          <button
            onClick={() => navigate('/login')}
            className={styles.loginBtn}
          >
            <UserIcon size={15} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
