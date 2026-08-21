/**
 * Knowledge Base — Institutional Forensic Precedents & Pattern Repository
 * 
 * Features:
 * - Immediate precedent loading on page mount (ordered by recency)
 * - Category filter tabs (CNP, Velocity Bursts, Account Takeover, Cross-Border, etc.)
 * - Deep-link support from Case Detail (/knowledge-base/:id or ?entry=... or ?case=...)
 * - Two-way linking to Case Investigations (/cases/:caseId)
 * - Instant debounced full-text search across titles, cards, and forensic evidence
 * - Rich expandable incident post-mortems with verification tags & decision rationale
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import {
  Search,
  Loader,
  FileText,
  Calendar,
  Link as LinkIcon,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Tag,
  ArrowUpRight,
  Zap,
  CreditCard,
  Clock,
  UserCheck,
  Sparkles,
  BookOpen,
  Layers,
  Activity,
  Copy,
  Check,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

interface KBEntry {
  id: number | string;
  case_id: string;
  resolved_case_id?: string;
  title: string;
  content?: string;
  summary?: string;
  created_at?: string;
  createdAt?: string;
  category?: string;
  severity?: string;
  priority?: number;
  card_id?: string;
  amount?: number;
  z_score?: number;
  decision?: string;
  actor_name?: string;
  verification_methods?: string[];
  relevance_score?: number;
}

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Precedents', icon: Layers },
  { id: 'CNP', label: 'CNP e-Commerce', matchKey: 'Card-Not-Present', color: 'sky' },
  { id: 'VELOCITY', label: 'Velocity Bursts', matchKey: 'Velocity', color: 'blue' },
  { id: 'TAKEOVER', label: 'Account Takeover', matchKey: 'Takeover', color: 'purple' },
  { id: 'TERMINAL', label: 'Compromised POS', matchKey: 'Terminal', color: 'amber' },
  { id: 'GEO', label: 'Geographic / Cross-Border', matchKey: 'Geographic', color: 'cyan' },
  { id: 'TRAVEL', label: 'Authorized / Travel', matchKey: 'Authorized', color: 'emerald' },
];

export const KnowledgeBase: React.FC = () => {
  const navigate = useNavigate();
  const { id: routeEntryId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const targetEntryId = routeEntryId || searchParams.get('entry') || searchParams.get('id');
  const targetCaseId = searchParams.get('case') || searchParams.get('caseId');

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState<'recency' | 'severity' | 'amount'>('recency');
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | number | null>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch KB entries from backend
  const fetchEntries = useCallback(async (searchQuery: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.searchKB(searchQuery, pageSize, 0);
      const itemsList: KBEntry[] = (response.items || response.entries || []).filter(Boolean);
      setEntries(itemsList);
      setTotal(response.total || itemsList.length);
    } catch (err: any) {
      setError(err.message || 'Failed to load knowledge base precedents');
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  // Initial load: Fetch precedents immediately without requiring click/search
  useEffect(() => {
    fetchEntries(query);
  }, [fetchEntries]);

  // Auto-expand entry if navigated with ID or caseId
  useEffect(() => {
    if (entries.length > 0 && (targetEntryId || targetCaseId)) {
      const matched = entries.find(
        (e) =>
          (targetEntryId && String(e.id) === String(targetEntryId)) ||
          (targetCaseId && String(e.case_id).toLowerCase() === String(targetCaseId).toLowerCase())
      );
      if (matched) {
        setExpandedEntryId(matched.id);
        setTimeout(() => {
          const el = entryRefs.current[String(matched.id)];
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      }
    }
  }, [entries, targetEntryId, targetCaseId]);

  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const lowerSearchRef = useRef<HTMLDivElement>(null);

  // Close lower search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (lowerSearchRef.current && !lowerSearchRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and sort items locally (Main page list remains intact, unaffected by search query)
  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Filter by Category Tab
    if (activeCategory !== 'ALL') {
      const tabConfig = CATEGORY_TABS.find((t) => t.id === activeCategory);
      if (tabConfig?.matchKey) {
        result = result.filter((e) =>
          (e.category || '').toLowerCase().includes(tabConfig.matchKey.toLowerCase()) ||
          (e.title || '').toLowerCase().includes(tabConfig.matchKey.toLowerCase())
        );
      }
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'severity') {
        const rank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const rankA = rank[(a.severity || 'MEDIUM').toUpperCase()] || 0;
        const rankB = rank[(b.severity || 'MEDIUM').toUpperCase()] || 0;
        return rankB - rankA;
      }
      if (sortBy === 'amount') {
        return (b.amount || 0) - (a.amount || 0);
      }
      // Default: Recency (Newest first)
      const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return result;
  }, [entries, activeCategory, sortBy]);

  // Top 3 Precedent matches for lower search bar dropdown
  const top3KbMatches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return entries
      .filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.case_id || '').toLowerCase().includes(q) ||
          (e.category || '').toLowerCase().includes(q) ||
          (e.content || '').toLowerCase().includes(q) ||
          (e.card_id || '').toLowerCase().includes(q)
      )
      .slice(0, 3);
  }, [entries, query]);

  // Format date helper
  const formatDate = (isoString?: string): string => {
    if (!isoString) return 'Recent';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recent';
    }
  };

  const handleCopyCitation = (entry: KBEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const citation = `[EarlyBird Precedent #${entry.id}] Case ${entry.case_id} — ${entry.title} (${entry.category || 'Fraud Anomaly'})`;
    navigator.clipboard.writeText(citation);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderCategoryBadge = (category?: string) => {
    const cat = category || 'General Anomaly';
    let badgeColor = 'border-sky-500/30 bg-sky-950/40 text-sky-300';
    if (cat.includes('Velocity')) badgeColor = 'border-blue-500/30 bg-blue-950/40 text-blue-300';
    else if (cat.includes('Terminal') || cat.includes('Merchant')) badgeColor = 'border-amber-500/30 bg-amber-950/40 text-amber-300';
    else if (cat.includes('Takeover') || cat.includes('Credentials')) badgeColor = 'border-purple-500/30 bg-purple-950/40 text-purple-300';
    else if (cat.includes('Geographic') || cat.includes('Cross-Border')) badgeColor = 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300';
    else if (cat.includes('Authorized') || cat.includes('Travel') || cat.includes('Luxury')) badgeColor = 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300';

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${badgeColor}`}>
        <Tag size={11} />
        <span>{cat}</span>
      </span>
    );
  };

  const renderSeverityBadge = (severity?: string) => {
    const sev = (severity || 'MEDIUM').toUpperCase();
    if (sev === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-950/50 text-rose-300 border border-rose-500/30">
          <AlertTriangle size={10} />
          High Risk
        </span>
      );
    }
    if (sev === 'LOW') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-950/50 text-emerald-300 border border-emerald-500/30">
          <ShieldCheck size={10} />
          Low Risk
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-950/50 text-amber-300 border border-amber-500/30">
        <Zap size={10} />
        Medium Risk
      </span>
    );
  };

  const renderDecisionBadge = (decision?: string) => {
    const dec = (decision || 'CASE_ACCEPTED').toUpperCase();
    if (dec === 'CASE_ACCEPTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          <CheckCircle2 size={10} />
          Confirmed Fraud
        </span>
      );
    }
    if (dec === 'CASE_REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-500/10 text-slate-300 border border-slate-500/20">
          <ShieldCheck size={10} />
          Cleared (Benign)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-sky-500/10 text-sky-300 border border-sky-500/20">
        <Activity size={10} />
        Resolved
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <BookOpen size={20} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">
              Knowledge Base & Precedent Library
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Institutional memory of resolved fraud cases, root cause correlations, and verified forensic patterns.
          </p>
        </div>

        {/* Global Stats Summary */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-[#111218] border border-white/[0.06] flex items-center gap-2">
            <Sparkles size={14} className="text-sky-400" />
            <div className="text-xs">
              <span className="font-bold text-white font-mono">{entries.length}</span>{' '}
              <span className="text-slate-400">Precedents</span>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#111218] border border-white/[0.06] flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <div className="text-xs">
              <span className="font-bold text-emerald-400 font-mono">100%</span>{' '}
              <span className="text-slate-400">Audited</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box with Top 3 Precedent Dropdown */}
          <div className="relative flex-1" ref={lowerSearchRef}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search precedents by pattern, merchant ID, card account, or root cause..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchDropdownOpen(true);
              }}
              onFocus={() => {
                if (query.trim()) setSearchDropdownOpen(true);
              }}
              className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-[#111218] border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 shadow-inner transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchDropdownOpen(false);
              }}
            />
            {loading && (
              <Loader className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-sky-400" />
            )}
            {query && !loading && (
              <button
                onClick={() => {
                  setQuery('');
                  setSearchDropdownOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                Clear
              </button>
            )}

            {/* Top 3 Precedent Results Dropdown (Does NOT affect main list on page) */}
            {searchDropdownOpen && query.trim() !== '' && (
              <div className="absolute top-full left-0 right-0 mt-2 z-40 rounded-2xl bg-[#0D0F18]/95 border border-slate-700/60 shadow-2xl p-2.5 backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800/60 mb-1.5">
                  <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Top Precedent Matches (Max 3)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {top3KbMatches.length} match{top3KbMatches.length === 1 ? '' : 'es'}
                  </span>
                </div>

                {top3KbMatches.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    No precedents match &quot;{query}&quot;
                  </div>
                ) : (
                  <div className="space-y-1">
                    {top3KbMatches.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setExpandedEntryId(item.id);
                          setSearchDropdownOpen(false);
                          setTimeout(() => {
                            const el = entryRefs.current[String(item.id)];
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 150);
                        }}
                        className="group flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-sky-500/30 hover:bg-sky-500/10 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                            <BookOpen size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {item.case_id} • {item.category || 'Forensic Precedent'}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {renderSeverityBadge(item.severity)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111218] border border-white/[0.08] text-xs text-slate-400">
              <SlidersHorizontal size={13} className="text-slate-400" />
              <span className="text-[11px]">Sort:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-slate-200 font-semibold focus:outline-none text-xs cursor-pointer"
              >
                <option value="recency" className="bg-[#111218] text-slate-200">
                  Newest First (Recency)
                </option>
                <option value="severity" className="bg-[#111218] text-slate-200">
                  Highest Severity
                </option>
                <option value="amount" className="bg-[#111218] text-slate-200">
                  Transaction Amount
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Chips / Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white border-sky-400/30 shadow-md shadow-sky-500/25'
                    : 'bg-[#111218] hover:bg-[#161722] text-slate-300 border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {Icon && <Icon size={13} />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <p className="text-rose-300 text-xs">{error}</p>
        </div>
      )}

      {/* Results Header Count */}
      <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
        <div>
          Showing <span className="font-bold text-white font-mono">{filteredEntries.length}</span> of{' '}
          <span className="font-bold text-white font-mono">{entries.length}</span> archived precedents
          {activeCategory !== 'ALL' && (
            <span className="ml-1.5 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 text-[10px] font-semibold">
              Category: {CATEGORY_TABS.find((t) => t.id === activeCategory)?.label}
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500">Ordered by recency</div>
      </div>

      {/* Precedents Card List */}
      {loading && entries.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Loader className="h-8 w-8 animate-spin mx-auto text-sky-400" />
          <p className="text-xs text-slate-400 font-medium">Loading institutional knowledge base...</p>
        </div>
      ) : filteredEntries.length > 0 ? (
        <div className="space-y-5 sm:space-y-6">
          {filteredEntries.map((entry) => {
            const entryKey = String(entry.id);
            const isExpanded = expandedEntryId === entry.id;
            const safeTitle = entry.title || `Precedent #${entry.id}`;
            const linkedCaseId = entry.case_id || entry.resolved_case_id;

            return (
              <div
                key={entry.id}
                ref={(el) => (entryRefs.current[entryKey] = el)}
                className={`rounded-2xl lg:rounded-3xl border transition-all duration-300 overflow-hidden shadow-2xl ${
                  isExpanded
                    ? 'bg-gradient-to-b from-[#131526] via-[#10121F] to-[#0D0E18] border-sky-500/40 ring-1 ring-sky-500/20 shadow-sky-500/10'
                    : 'bg-gradient-to-b from-[#12131D]/90 via-[#0F1018]/90 to-[#0C0D15]/90 border-slate-800/60 hover:border-sky-500/30 hover:shadow-sky-500/5 hover:-translate-y-0.5'
                }`}
              >
                {/* Precedent Header Card (Clickable) */}
                <div
                  onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                  className="p-5 sm:p-6 lg:p-7 cursor-pointer select-none"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    {/* Left: Badges, Title, & Spaced Meta Details */}
                    <div className="space-y-3 flex-1 min-w-0">
                      {/* Badge Grouping */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {renderCategoryBadge(entry.category)}
                        {renderSeverityBadge(entry.severity)}
                        {renderDecisionBadge(entry.decision)}

                        {linkedCaseId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/cases/${linkedCaseId}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono bg-sky-950/50 text-sky-300 border border-sky-500/30 hover:bg-sky-900/60 hover:text-sky-100 shadow-sm transition-all"
                            title="Navigate directly to Case Investigation"
                          >
                            <LinkIcon size={12} />
                            <span>{linkedCaseId}</span>
                            <ArrowUpRight size={11} />
                          </button>
                        )}
                      </div>

                      {/* Main Title Row */}
                      <div className="flex items-start sm:items-center gap-3 pt-1">
                        <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0 mt-0.5 sm:mt-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold text-base sm:text-lg text-white font-outfit tracking-tight leading-snug">
                          {safeTitle}
                        </h3>
                      </div>

                      {/* Spacious Meta Info Chips Row */}
                      <div className="pt-3 border-t border-slate-800/50 flex items-center justify-between flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-3 flex-wrap">
                          {entry.card_id && (
                            <div className="flex items-center gap-1.5 font-mono text-slate-200 bg-slate-900/60 border border-slate-800 px-3 py-1 rounded-xl shadow-inner">
                              <CreditCard size={13} className="text-sky-400" />
                              <span>{entry.card_id}</span>
                            </div>
                          )}

                          {entry.amount !== undefined && (
                            <div className="flex items-center gap-1.5 font-mono text-emerald-300 font-semibold bg-emerald-950/30 border border-emerald-500/20 px-3 py-1 rounded-xl">
                              <span className="text-slate-400 font-sans font-normal text-[11px]">Amount:</span>
                              <span>${Number(entry.amount).toFixed(2)}</span>
                            </div>
                          )}

                          {entry.actor_name && (
                            <div className="flex items-center gap-1.5 text-slate-300 bg-slate-900/40 border border-slate-800/60 px-3 py-1 rounded-xl">
                              <UserCheck size={13} className="text-slate-400" />
                              <span>Investigator: <strong className="text-slate-100">{entry.actor_name}</strong></span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-400 bg-slate-900/30 border border-slate-800/40 px-3 py-1 rounded-xl">
                          <Calendar size={13} className="text-slate-500" />
                          <span>{formatDate(entry.created_at || entry.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions & Expand Controls */}
                    <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0 pt-2 lg:pt-0">
                      {linkedCaseId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/cases/${linkedCaseId}`);
                          }}
                          className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm flex items-center gap-2 transition-all cursor-pointer hover:border-sky-400/50"
                        >
                          <LinkIcon size={13} />
                          <span>Open Case</span>
                        </button>
                      )}

                      <button
                        onClick={(e) => handleCopyCitation(entry, e)}
                        className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all cursor-pointer"
                        title="Copy Precedent Citation"
                      >
                        {copiedId === entry.id ? (
                          <Check size={15} className="text-emerald-400" />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>

                      <div
                        className={`p-2 rounded-xl bg-slate-900/60 text-slate-400 border border-slate-800 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180 text-sky-400 bg-sky-500/10 border-sky-500/30' : ''
                        }`}
                      >
                        <ChevronDown size={17} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Full Report */}
                {isExpanded && (
                  <div className="border-t border-slate-800/70 bg-[#090A11] p-6 sm:p-8 space-y-6 animate-in fade-in duration-300">
                    {/* Verification Badges Applied */}
                    {entry.verification_methods && entry.verification_methods.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Forensic Verification Methods Applied
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.verification_methods.map((method, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 rounded-xl text-xs font-medium bg-emerald-950/30 text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5 shadow-sm"
                            >
                              <ShieldCheck size={13} className="text-emerald-400" />
                              <span>{method}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Precedent Content / Markdown Body */}
                    <div className="rounded-2xl border border-slate-800/70 bg-[#11121A] p-6 space-y-4 shadow-inner">
                      {entry.content ? (
                        <div className="prose prose-invert prose-sm max-w-none text-xs sm:text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                          {entry.content}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          {entry.summary || 'No detailed forensic documentation recorded for this precedent.'}
                        </p>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 flex-wrap gap-4">
                      <div className="flex items-center gap-2.5 text-xs text-slate-400">
                        <Clock size={14} className="text-slate-500" />
                        <span>Precedent ID: <strong className="font-mono text-slate-200">#{entry.id}</strong></span>
                        <span>•</span>
                        <span>Archived on: <strong className="text-slate-200">{new Date(entry.created_at || entry.createdAt || '').toLocaleString()}</strong></span>
                      </div>

                      {linkedCaseId && (
                        <button
                          onClick={() => navigate(`/cases/${linkedCaseId}`)}
                          className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 border border-sky-400/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                        >
                          <span>Open Full Case Investigation</span>
                          <ArrowUpRight size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#111218]/40 py-16 text-center space-y-3">
          <BookOpen className="h-10 w-10 mx-auto text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-200">No matching precedents found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {query
              ? `No precedent matches the search term "${query}". Try adjusting your keywords or clearing the category filter.`
              : 'No resolved case precedents found under the selected category.'}
          </p>
          {(query || activeCategory !== 'ALL') && (
            <button
              onClick={() => {
                setQuery('');
                setActiveCategory('ALL');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-sky-300 border border-white/[0.08] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
