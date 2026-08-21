/**
 * Main Layout Component
 * Unified, seamless sidebar + navbar design matching modern fintech aesthetic
 * Deep near-black background (#08090C), subtle borders, light blue / cyan accents
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import {
  Menu,
  X,
  LogOut,
  Sliders,
  LayoutDashboard,
  ShieldAlert,
  BookOpen,
  Search,
  Loader2,
  ChevronRight,
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

  // Live top 3 search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch top 3 relevant search results as user types
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setDropdownOpen(false);
      return;
    }

    setSearchLoading(true);
    setDropdownOpen(true);

    const timer = setTimeout(async () => {
      try {
        const q = searchQuery.trim().toLowerCase();

        // Query Cases (all states) and Knowledge Base in parallel
        const [casesRes, kbRes] = await Promise.allSettled([
          apiClient.getCases({ state: 'ALL', limit: 100 }),
          apiClient.searchKB(searchQuery, 10, 0),
        ]);

        const combinedResults: any[] = [];

        // Safely extract Cases list
        let rawCases: any[] = [];
        if (casesRes.status === 'fulfilled' && casesRes.value) {
          const val = casesRes.value;
          if (Array.isArray(val)) {
            rawCases = val;
          } else if (val && typeof val === 'object') {
            rawCases = val.cases || val.items || [];
          }
        }

        // Safely extract KB Precedents list
        let rawKb: any[] = [];
        if (kbRes.status === 'fulfilled' && kbRes.value) {
          const val = kbRes.value;
          if (Array.isArray(val)) {
            rawKb = val;
          } else if (val && typeof val === 'object') {
            rawKb = val.items || val.entries || val.results || [];
          }
        }

        // Process Cases matches
        rawCases.forEach((c: any) => {
          if (!c) return;
          const idStr = String(c.id || '').toLowerCase();
          const caseIdStr = String(c.case_id || '').toLowerCase();
          const entityStr = String(c.entity_id || '').toLowerCase();
          const stateStr = String(c.state || '').toLowerCase();
          const severityStr = String(c.severity || '').toLowerCase();

          if (
            idStr.includes(q) ||
            caseIdStr.includes(q) ||
            entityStr.includes(q) ||
            stateStr.includes(q) ||
            severityStr.includes(q) ||
            q.includes('case') ||
            q.includes('alert')
          ) {
            const displayId = c.case_id || (typeof c.id === 'string' && c.id.startsWith('CASE-') ? c.id : `CASE-${c.id}`);
            combinedResults.push({
              id: `case-${c.id || c.case_id}`,
              case_id: c.case_id || String(c.id),
              title: `Alert Case ${displayId}`,
              subtitle: `Entity: ${c.entity_id || 'N/A'} • Score: ${c.anomaly_score ? c.anomaly_score.toFixed(2) + 'σ' : 'N/A'}`,
              type: 'CASE',
              badgeText: c.state || 'NEW',
              badgeColor:
                c.state === 'RESOLVED'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : c.state === 'ESCALATED'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/30',
              url: `/cases/${c.case_id || c.id}`,
            });
          }
        });

        // Process KB Precedent matches
        rawKb.forEach((k: any) => {
          if (!k) return;
          const titleStr = String(k.title || '').toLowerCase();
          const caseIdStr = String(k.case_id || '').toLowerCase();
          const catStr = String(k.category || '').toLowerCase();
          const contentStr = String(k.content || '').toLowerCase();
          const cardStr = String(k.card_id || '').toLowerCase();

          if (
            titleStr.includes(q) ||
            caseIdStr.includes(q) ||
            catStr.includes(q) ||
            contentStr.includes(q) ||
            cardStr.includes(q) ||
            q.includes('case') ||
            q.includes('precedent')
          ) {
            combinedResults.push({
              id: `kb-${k.id || k.case_id}`,
              case_id: k.case_id || String(k.id),
              title: k.title || `Precedent ${k.case_id}`,
              subtitle: `Precedent • ${k.category || 'RCA Investigation'}`,
              type: 'PRECEDENT',
              badgeText: 'PRECEDENT',
              badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
              url: `/knowledge-base?case=${k.case_id || k.id}`,
            });
          }
        });

        // Deduplicate by case_id and limit to top 3 items
        const uniqueMap = new Map<string, any>();
        combinedResults.forEach((item) => {
          if (!uniqueMap.has(item.case_id)) {
            uniqueMap.set(item.case_id, item);
          }
        });

        const top3 = Array.from(uniqueMap.values()).slice(0, 3);
        setSearchResults(top3);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

          {/* Stretched Integrated Search Bar with Top 3 Dropdown */}
          <div className="flex-1 max-w-xl lg:max-w-2xl relative" ref={searchContainerRef}>
            <div className="relative w-full">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search card, entity ID, or forensic keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim()) setDropdownOpen(true);
                }}
                className="w-full pl-10 pr-9 py-2 text-xs rounded-xl bg-[#11131F]/80 border border-slate-800/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all shadow-inner"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setDropdownOpen(false);
                  } else if (e.key === 'Enter') {
                    setDropdownOpen(false);
                    navigate(`/cases?search=${encodeURIComponent(searchQuery)}`);
                  }
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDropdownOpen(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Top 3 Search Results Dropdown */}
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-[#0D0F18]/95 border border-slate-700/60 shadow-2xl p-2.5 backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800/60 mb-1.5">
                  <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Top Relevant Results (Max 3)
                  </span>
                  {searchLoading && <Loader2 size={12} className="animate-spin text-sky-400" />}
                </div>

                {searchLoading && searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin text-sky-400" />
                    <span>Searching database...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No relevant alerts or precedents found for &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setDropdownOpen(false);
                          setSearchQuery('');
                          navigate(item.url);
                        }}
                        className="group flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-sky-500/30 hover:bg-sky-500/10 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-sky-400 group-hover:text-sky-300 group-hover:border-sky-500/40 shrink-0">
                            {item.type === 'CASE' ? <ShieldAlert size={15} /> : <BookOpen size={15} />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${item.badgeColor}`}
                        >
                          {item.badgeText}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* View All Footer */}
                <div
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/cases');
                  }}
                  className="mt-1.5 pt-2 border-t border-slate-800/60 px-2.5 py-1 text-right"
                >
                  <button className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center justify-end gap-1 ml-auto cursor-pointer">
                    <span>View all matching alerts in Queue</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
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
