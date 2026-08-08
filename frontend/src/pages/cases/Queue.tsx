import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import anime from 'animejs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/index';
import { StateBadge } from '../../components/shared/StateBadge';
import { SLABadge } from '../../components/shared/SLABadge';
import { apiClient } from '../../lib/api';
import { CaseState, CaseSeverity, DEFAULT_PAGE_SIZE, SLA_WINDOW_MS } from '../../lib/constants';
import { RefreshCw, ChevronLeft, ChevronRight, Search, Zap, ArrowUpDown } from 'lucide-react';

interface CaseRow {
  id: string;
  entity_id: string;
  anomaly_score: number;
  state: CaseState;
  created_at: string;
  severity: CaseSeverity;
}

interface CasesResponse {
  cases: CaseRow[];
  total: number;
}

type SortField = 'sla' | 'created_at' | 'score';
type StateFilter = 'ALL' | 'NEW' | 'ESCALATED' | 'RESOLVED';

export const CaseQueue: React.FC = () => {
  const navigate = useNavigate();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>('sla');
  const [stateFilter, setStateFilter] = useState<StateFilter>('ALL');
  const [searchEntity, setSearchEntity] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const fetchCases = async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getCases({
        state: stateFilter,
        limit: DEFAULT_PAGE_SIZE,
        offset: currentPage * DEFAULT_PAGE_SIZE,
      });

      const data = response as CasesResponse;
      let sorted = [...(data.cases || [])];

      if (sortBy === 'sla') {
        sorted.sort((a, b) => {
          const aRemaining = SLA_WINDOW_MS - (Date.now() - new Date(a.created_at).getTime());
          const bRemaining = SLA_WINDOW_MS - (Date.now() - new Date(b.created_at).getTime());
          return aRemaining - bRemaining;
        });
      } else if (sortBy === 'created_at') {
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } else if (sortBy === 'score') {
        sorted.sort((a, b) => (b.anomaly_score || 0) - (a.anomaly_score || 0));
      }

      if (searchEntity.trim()) {
        sorted = sorted.filter((c) =>
          (c.entity_id || '').toLowerCase().includes(searchEntity.toLowerCase()) ||
          c.id.toLowerCase().includes(searchEntity.toLowerCase())
        );
      }

      setCases(sorted);
      setTotalCases(data.total || sorted.length);
    } catch (err: any) {
      setError(err.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortBy, stateFilter]);

  // anime.js staggered row entrance
  useEffect(() => {
    if (!loading && tableContainerRef.current && cases.length > 0) {
      anime({
        targets: tableContainerRef.current.querySelectorAll('.case-table-row'),
        opacity: [0, 1],
        translateY: [8, 0],
        easing: 'easeOutQuad',
        duration: 320,
        delay: anime.stagger(18),
      });
    }
  }, [cases, loading]);

  const handleTriggerDetection = async () => {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await apiClient.triggerDetection();
      setTriggerMsg(`Engine Sweep Complete: ${res.anomalies_detected || 0} anomalies evaluated, ${res.cases_created_or_merged || 0} alerts updated.`);
      await fetchCases(0);
    } catch (err: any) {
      setTriggerMsg(`Detection failed: ${err.message || 'Error'}`);
    } finally {
      setTriggering(false);
    }
  };

  const handleCaseClick = (caseId: string) => {
    navigate(`/cases/${caseId}`);
  };

  const totalPages = Math.ceil(totalCases / DEFAULT_PAGE_SIZE);
  const canPrevPage = page > 0;
  const canNextPage = page < totalPages - 1;

  const severityGlow = {
    [CaseSeverity.LOW]: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    [CaseSeverity.MEDIUM]: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    [CaseSeverity.HIGH]: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    [CaseSeverity.CRITICAL]: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className="space-y-5">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Alert Queue
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time fraud anomaly queue and prioritized triage workspace
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleTriggerDetection}
            disabled={triggering}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/25 border border-violet-400/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Zap size={14} className={triggering ? 'animate-spin text-amber-300' : 'text-violet-200'} />
            <span>{triggering ? 'Scanning...' : 'Trigger Detection Engine'}</span>
          </button>
          <button
            onClick={() => fetchCases(page)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#12131A] hover:bg-[#181A24] text-slate-200 border border-white/[0.08] hover:border-white/[0.15] flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-slate-400' : 'text-slate-400'} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {triggerMsg && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 px-4 py-3 flex items-center justify-between text-xs text-violet-200 shadow-sm">
          <span>{triggerMsg}</span>
          <button
            onClick={() => setTriggerMsg(null)}
            className="text-violet-400 hover:text-white font-medium ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Controls Toolbar */}
      <div className="p-2.5 rounded-2xl bg-[#111218] border border-white/[0.06] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-lg">
        {/* State Filter Tabs (Like inspo pill button group) */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#08090C] border border-white/[0.04]">
          {(['ALL', 'NEW', 'ESCALATED', 'RESOLVED'] as StateFilter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStateFilter(tab);
                setPage(0);
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                stateFilter === tab
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {tab === 'ALL' ? 'All Alerts' : tab}
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-1 items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search card or entity ID..."
              value={searchEntity}
              onChange={(e) => {
                setSearchEntity(e.target.value);
                setPage(0);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#08090C] border border-white/[0.06] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="px-3 py-1.5 text-xs rounded-xl bg-[#08090C] border border-white/[0.06] text-slate-300 focus:outline-none focus:border-violet-500/50 cursor-pointer appearance-none pr-7"
            >
              <option value="sla">SLA (Urgent First)</option>
              <option value="created_at">Newest First</option>
              <option value="score">Highest Z-Score</option>
            </select>
            <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111218] p-12 text-center shadow-xl">
          <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500 mb-3" />
          <p className="text-xs text-slate-400 font-medium">Scanning live anomaly queue...</p>
        </div>
      )}

      {/* Cases Table */}
      {!loading && cases.length > 0 && (
        <div
          ref={tableContainerRef}
          className="rounded-2xl border border-white/[0.06] bg-[#111218] overflow-hidden shadow-2xl"
        >
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#0D0E14] border-b border-white/[0.06]">
                <TableRow className="border-b-0">
                  <TableHead className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Case ID
                  </TableHead>
                  <TableHead className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Entity (Card)
                  </TableHead>
                  <TableHead className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Z-Score
                  </TableHead>
                  <TableHead className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Triage State
                  </TableHead>
                  <TableHead className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    SLA Status
                  </TableHead>
                  <TableHead className="py-3.5 px-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((caseRow) => (
                  <TableRow
                    key={caseRow.id}
                    onClick={() => handleCaseClick(caseRow.id)}
                    className="case-table-row transition-colors cursor-pointer hover:bg-white/[0.03] border-b border-white/[0.04]"
                  >
                    <TableCell className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-300">
                      {caseRow.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs font-mono font-medium text-indigo-300">
                      {caseRow.entity_id}
                    </TableCell>
                    <TableCell className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${severityGlow[caseRow.severity]}`}
                      >
                        {caseRow.anomaly_score.toFixed(1)}σ
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-4">
                      <StateBadge state={caseRow.state} />
                    </TableCell>
                    <TableCell className="py-3.5 px-4">
                      <SLABadge createdAt={caseRow.created_at} />
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCaseClick(caseRow.id);
                        }}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-600/20 transition-all cursor-pointer active:scale-95"
                      >
                        Review
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && cases.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111218] p-12 text-center shadow-xl">
          <p className="text-xs text-slate-400">No alert cases matching current criteria.</p>
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <p className="text-xs text-slate-400">
            Page <strong className="text-slate-200">{page + 1}</strong> of {totalPages} ({totalCases} total alerts)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={!canPrevPage}
              className="h-8 px-3 rounded-lg bg-[#12131A] hover:bg-[#181A24] border border-white/[0.08] text-xs font-medium text-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!canNextPage}
              className="h-8 px-3 rounded-lg bg-[#12131A] hover:bg-[#181A24] border border-white/[0.08] text-xs font-medium text-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseQueue;
