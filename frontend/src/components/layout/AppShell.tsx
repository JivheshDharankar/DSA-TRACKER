import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MEDIA } from '../../styles/breakpoints';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { NavDrawer } from './NavDrawer';
import styles from './AppShell.module.css';

/**
 * DSA Tracker — Application shell (Phase 3)
 * =========================================
 * Layout route for every route in the app; it owns the chrome and renders the page
 * through `<Outlet/>`, exactly as before.
 *
 *   >=1024px  sidebar (240px)
 *    768–1023 sidebar rail (64px)
 *   <768px    mobile topbar + bottom bar (56px) + "More" drawer
 *
 * Breakpoints come from `styles/breakpoints.ts` so the JavaScript behaviour and the
 * stylesheet agree on the same boundaries. The rail/sidebar difference is pure CSS;
 * only the mobile-only elements are gated in JavaScript, which also guarantees an open
 * drawer is closed when the viewport grows past the mobile breakpoint.
 */

export const AppShell: React.FC = () => {
  const isMobile = useMediaQuery(MEDIA.mobile);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setIsDrawerOpen(false);
    }
  }, [isMobile]);

  return (
    <div className={styles.shell}>
      <Sidebar />

      <div className={styles.mainWrapper}>
        <Header />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>

      {isMobile ? (
        <>
          <BottomNav isMoreOpen={isDrawerOpen} onOpenMore={() => setIsDrawerOpen(true)} />
          <NavDrawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
        </>
      ) : null}
    </div>
  );
};
