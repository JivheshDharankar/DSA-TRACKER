import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import styles from './AppShell.module.css';

export const AppShell: React.FC = () => {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.mainWrapper}>
        <Header />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
