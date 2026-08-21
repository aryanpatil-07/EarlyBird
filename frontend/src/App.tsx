/**
 * App Router & Layout
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CaseQueue } from './pages/cases/Queue';
import { CaseDetail } from './pages/cases/Detail';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Settings } from './pages/settings/Rules';
import { Layout } from './components/Layout';
import './App.css';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#08090C] text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-500 border-t-transparent mb-3" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

const TeamLeadRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#08090C] text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-500 border-t-transparent mb-3" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'TEAM_LEAD') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cases"
        element={
          <ProtectedRoute>
            <CaseQueue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cases/:caseId"
        element={
          <ProtectedRoute>
            <CaseDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge-base"
        element={
          <ProtectedRoute>
            <KnowledgeBase />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge-base/:id"
        element={
          <ProtectedRoute>
            <KnowledgeBase />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/rules"
        element={
          <TeamLeadRoute>
            <Settings />
          </TeamLeadRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
