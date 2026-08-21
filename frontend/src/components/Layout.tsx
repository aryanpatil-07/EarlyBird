/**
 * Main Layout Component
 * Unified, seamless sidebar + navbar design matching modern fintech aesthetic
 * Deep near-black background (#08090C), subtle borders, light blue / cyan accents
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Menu,
  X,
  LogOut,
  Sliders,
  LayoutDashboard,
  ShieldAlert,
  BookOpen,
  Search,
  ChevronDown,
  Activity,
  ArrowRightLeft,
} from 'lucide-react';
import { APP_NAME } from '../lib/constants';
import { EarlyBirdLogo } from './ui/EarlyBirdLogo';

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
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Alert Queue', path: '/cases', icon: ShieldAlert },
    { label: 'Knowledge Base', path: '/knowledge-base', icon: BookOpen },
    { label: 'Playbook Rules', path: '/settings/rules', icon: Sliders, teamLeadOnly: true },
  ];

  const filteredNavItems = navItems.filter(
    (item) => !item.teamLeadOnly || user?.role === 'TEAM_LEAD'
  );

  const isActive = (path: string) => {
    if (path === '/cases') {
      return location.pathname === '/cases' || location.pathname.startsWith('/cases/');
    }
    return location.pathname === path;
  };

  const isTeamLead = user?.role === 'TEAM_LEAD';
  const userName = isTeamLead ? 'Sarah (Team Lead)' : 'Alex (Reviewer)';
  const userInitials = isTeamLead ? 'ST' : 'AR';
  const userRoleSubtitle = isTeamLead ? 'Supervisory Lead' : 'Fraud Investigator';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#08090C] text-slate-100 font-sans antialiased selection:bg-sky-500/30 selection:text-sky-200">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0B0C10]/95 backdrop-blur-xl border-r border-slate-800/50 transition-transform duration-300 md:relative md:translate-x-0 flex flex-col justify-between ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo Header */}
          <div className="px-6 py-5 flex items-center justify-between border-b border-slate-800/40">
            <div className="flex items-center gap-3">
              <EarlyBirdLogo size={36} className="h-9 w-9" />
              <div>
                <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  {APP_NAME}
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                </h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide">
                  Fraud Anomaly Radar
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-slate-400 hover:text-white p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Menu */}
          <div className="px-3 py-6">
            <div className="px-3 mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Workspace Menu
            </div>
            <nav className="space-y-1.5">
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
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-3 cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 border border-sky-400/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <Icon size={17} className={active ? 'text-white' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-slate-800/40">
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all duration-200 cursor-pointer border border-transparent hover:border-rose-500/20"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#08090C]">
        {/* Top Navbar */}
        <header className="h-16 px-6 lg:px-8 flex items-center justify-between gap-4 border-b border-slate-800/50 bg-[#08090C]/80 backdrop-blur-xl sticky top-0 z-30">
          {/* Left: Mobile Toggle */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Stretched Integrated Search Bar */}
          <div className="flex-1 max-w-xl lg:max-w-2xl">
            <div className="relative w-full">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search card, entity ID, or forensic keyword..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-[#11131F]/80 border border-slate-800/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all shadow-inner"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigate('/cases');
                  }
                }}
              />
            </div>
          </div>

          {/* Right: User Profile Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 p-1.5 pl-2.5 pr-3.5 rounded-2xl bg-[#11131F]/80 border border-slate-800/60 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-400 to-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-inner">
                {userInitials}
              </div>
              <div className="text-left pr-1">
                <div className="text-xs font-bold text-white leading-tight">{userName}</div>
                <div className="text-[10px] text-slate-400 font-medium">{userRoleSubtitle}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Viewport Scroll Container */}
        <main className="flex-1 overflow-y-auto bg-[#08090C]">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}
    </div>
  );
};

export default Layout;
