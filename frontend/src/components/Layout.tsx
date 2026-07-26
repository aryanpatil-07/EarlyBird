/**
 * Main Layout Component
 * 
 * Sidebar navigation + header + main content area
 * Responsive: sidebar collapses on mobile
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { Menu, X, LogOut, Settings } from 'lucide-react';
import { APP_NAME } from '../lib/constants.ts';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Cases', path: '/cases', icon: '📋' },
    { label: 'Knowledge Base', path: '/knowledge-base', icon: '📚' },
    { label: 'Settings', path: '/settings/rules', icon: '⚙️', teamLeadOnly: true },
  ];

  const filteredNavItems = navItems.filter(
    item => !item.teamLeadOnly || user?.role === 'TEAM_LEAD'
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              🐦 {APP_NAME}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Fraud Detection
            </p>
          </div>

          {/* User Info */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <p className="text-sm font-medium text-primary-600 dark:text-primary-400">
              {user?.userId}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {user?.role}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-2">
            {filteredNavItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-primary-600 hover:text-white text-gray-900 dark:text-gray-50 dark:hover:bg-primary-600"
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-error-600 dark:text-error-400 hover:bg-error-100 dark:hover:bg-error-900 hover:text-error-700 dark:hover:text-error-200 transition-colors"
            >
              <LogOut size={16} className="mr-2" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {sidebarOpen ? (
              <X size={24} className="text-primary-600 dark:text-primary-400" />
            ) : (
              <Menu size={24} className="text-primary-600 dark:text-primary-400" />
            )}
          </button>

          <div className="flex-1 md:flex-none">
            <h2 className="text-lg font-semibold text-primary-600 dark:text-primary-400">
              {APP_NAME}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings/rules')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      )}
    </div>
  );
};
