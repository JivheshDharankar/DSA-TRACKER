import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  Code2,
  Repeat,
  History,
  Network,
  Lock,
  LogIn,
  UserPlus,
  Layers,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './Sidebar.module.css';

export const Sidebar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <Layers size={18} />
        </div>
        <span className={styles.brandName}>DSA Tracker</span>
      </div>

      <nav className={styles.navSection}>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
          }
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <div className={styles.sectionHeading}>MY DSA</div>
        <NavLink
          to="/college-dsa"
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
          }
        >
          <GraduationCap size={18} />
          <span>College DSA</span>
        </NavLink>

        <NavLink
          to="/personal-dsa"
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
          }
        >
          <Code2 size={18} />
          <span>Personal DSA</span>
        </NavLink>

        <div className={styles.sectionHeading}>SPACED REPETITION</div>
        <NavLink
          to="/review"
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
          }
        >
          <Repeat size={18} />
          <span>Reviews</span>
        </NavLink>

        <NavLink
          to="/reviews/history"
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
          }
        >
          <History size={18} />
          <span>Review History</span>
        </NavLink>

        <div className={styles.sectionHeading}>MASTERY</div>
        <NavLink
          to="/patterns"
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
          }
        >
          <Network size={18} />
          <span>Patterns</span>
        </NavLink>

        <NavLink
          to="/problems/locked"
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
          }
        >
          <Lock size={18} />
          <span>Locked Problems</span>
        </NavLink>

        {!isAuthenticated && (
          <>
            <div className={styles.sectionHeading}>Account</div>
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <LogIn size={18} />
              <span>Sign In</span>
            </NavLink>

            <NavLink
              to="/register"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <UserPlus size={18} />
              <span>Register</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className={styles.sidebarFooter}>
        {isAuthenticated && user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className={styles.userFootprint}>
              <UserIcon size={14} color="var(--accent-cyan)" />
              <span className={styles.userFootprintEmail} title={user.email}>
                {user.name || user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                minHeight: '38px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#f87171';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
              title="Sign Out of session"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
};
