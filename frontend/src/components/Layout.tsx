/**
 * Main Layout Component
 * 
 * Sidebar navigation + header + main content area
 * Responsive: sidebar collapses on mobile
 * Dark mode OLED aesthetic with design system colors
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LogOut, Settings, BarChart3, FileText, Book } from 'lucide-react';
import { APP_NAME } from '../lib/constants';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: BarChart3 },
    { label: 'Cases', path: '/cases', icon: FileText },
    { label: 'Knowledge Base', path: '/knowledge-base', icon: Book },
    { label: 'Settings', path: '/settings/rules', icon: Settings, teamLeadOnly: true },
  ];

  const filteredNavItems = navItems.filter(
    item => !item.teamLeadOnly || user?.role === 'TEAM_LEAD'
  );

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: 'var(--color-background-alt)',
          borderRightColor: 'var(--color-border)',
          borderRightWidth: '1px',
        }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div
            className="p-6"
            style={{
              borderBottomColor: 'var(--color-border)',
              borderBottomWidth: '1px',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              {/* Logo icon - simple geometric shape instead of emoji */}
              <div
                className="w-8 h-8 rounded flex items-center justify-center font-bold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                EB
              </div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {APP_NAME}
              </h1>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Fraud Detection
            </p>
          </div>

          {/* User Info */}
          <div
            className="px-6 py-4"
            style={{
              backgroundColor: 'var(--color-background-muted)',
              borderBottomColor: 'var(--color-border)',
              borderBottomWidth: '1px',
            }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
              {user?.userId}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {user?.role}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--color-accent)' : 'transparent',
                    color: active ? 'white' : 'var(--color-text-secondary)',
                    borderRadius: '8px',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'var(--color-background-muted)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <Icon size={18} strokeWidth={2} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div
            style={{
              borderTopColor: 'var(--color-border)',
              borderTopWidth: '1px',
            }}
            className="p-3"
          >
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              style={{
                color: 'var(--color-destructive)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
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
        <header
          className="px-6 py-4 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--color-background-alt)',
            borderBottomColor: 'var(--color-border)',
            borderBottomWidth: '1px',
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg transition-colors duration-200 cursor-pointer"
            style={{
              color: 'var(--color-primary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-background-muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {sidebarOpen ? (
              <X size={24} />
            ) : (
              <Menu size={24} />
            )}
          </button>

          <div className="flex-1 md:flex-none">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
              {APP_NAME}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings/rules')}
              className="p-2 rounded-lg transition-colors duration-200 cursor-pointer"
              style={{
                color: 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-background-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-background)' }}>
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        />
      )}
    </div>
  );
};
