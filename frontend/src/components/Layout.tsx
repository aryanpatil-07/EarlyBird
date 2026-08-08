/**
 * Main Layout Component
 * Unified, seamless sidebar + navbar design matching modern fintech aesthetic
 * Deep near-black background (#08090C), subtle borders, vibrant violet accents
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

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, switchRole } = useAuth();
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#08090C] text-slate-100 font-sans antialiased selection:bg-violet-500/30 selection:text-violet-200">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0B0C10] border-r border-white/[0.06] transition-transform duration-300 md:relative md:translate-x-0 flex flex-col justify-between ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo Header */}
          <div className="px-6 py-5 flex items-center justify-between border-b border-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-purple-400 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-violet-500/30 tracking-wider">
                EB
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  {APP_NAME}
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
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
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/25 border border-violet-400/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
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
        <div className="p-3.5 border-t border-white/[0.05] space-y-2">
          {/* Live Telemetry Status */}
          <div className="px-3 py-2 rounded-xl bg-[#12131A] border border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium text-slate-300">Detection Engine</span>
            </div>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
              LIVE
            </span>
          </div>

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
        <header className="h-16 px-6 lg:px-8 flex items-center justify-between border-b border-white/[0.06] bg-[#08090C]/90 backdrop-blur-md sticky top-0 z-30">
          {/* Left: Mobile Toggle + Breadcrumb Plan Pill */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl bg-[#12131A] border border-white/[0.08] hover:border-white/[0.15] text-xs font-semibold text-slate-200 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Activity size={14} className="text-violet-400" />
                <span>EarlyBird Core</span>
                <ChevronDown size={13} className="text-slate-400" />
              </button>
            </div>
          </div>

          {/* Middle: Integrated Search Bar (matching inspiration) */}
          <div className="hidden sm:flex items-center">
            <div className="relative w-64 md:w-80">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search card, entity ID, or keyword..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl bg-[#12131A] border border-white/[0.06] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigate('/cases');
                  }
                }}
              />
            </div>
          </div>

          {/* Right: Unified User Profile & Role Switcher Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 p-1.5 pl-2.5 pr-2 rounded-2xl bg-[#12131A] border border-white/[0.08] shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-inner">
                {userInitials}
              </div>
              <div className="hidden md:block text-left pr-1">
                <div className="text-xs font-bold text-white leading-tight">{userName}</div>
                <div className="text-[10px] text-slate-400 font-medium">{userRoleSubtitle}</div>
              </div>
              <button
                onClick={() => switchRole()}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                title="Switch persona between Reviewer and Team Lead"
              >
                <ArrowRightLeft size={12} />
                <span className="hidden sm:inline">Switch</span>
              </button>
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
