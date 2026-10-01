import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { GuestRoute } from './components/common/GuestRoute';
import { DashboardPage } from './pages/DashboardPage';
import { CollegeDsaPage } from './pages/CollegeDsaPage';
import { PersonalDsaPage } from './pages/PersonalDsaPage';
import { ReviewPage } from './pages/ReviewPage';
import { PatternsPage } from './pages/PatternsPage';
import { PatternDetailPage } from './pages/PatternDetailPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProblemDetailPage } from './pages/ProblemDetailPage';
import { ReviewHistoryPage } from './pages/ReviewHistoryPage';
import { LockedProblemsPage } from './pages/LockedProblemsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              {/* Root redirect */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* Guest-only auth routes */}
              <Route element={<GuestRoute />}>
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
              </Route>

              {/* Protected application routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="college-dsa" element={<CollegeDsaPage />} />
                <Route path="personal-dsa" element={<PersonalDsaPage />} />
                <Route path="review" element={<ReviewPage />} />
                <Route path="reviews/history" element={<ReviewHistoryPage />} />
                <Route path="patterns" element={<PatternsPage />} />
                <Route path="patterns/:id" element={<PatternDetailPage />} />
                <Route path="problems/locked" element={<LockedProblemsPage />} />
                <Route path="mastery/locked" element={<Navigate to="/problems/locked" replace />} />
                <Route path="problems/:id" element={<ProblemDetailPage />} />
              </Route>

              {/* 404 fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
