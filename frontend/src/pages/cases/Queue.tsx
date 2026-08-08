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
  Button,
  Input,
  Card,
  CardContent,
} from '../../components/ui/index';
import { StateBadge } from '../../components/shared/StateBadge';
import { SLABadge } from '../../components/shared/SLABadge';
import { apiClient } from '../../lib/api';
import { CaseState, CaseSeverity, DEFAULT_PAGE_SIZE, SLA_WINDOW_MS } from '../../lib/constants';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

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

      // Client-side sorting by priority
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

      // Filter by entity if search is active
      if (searchEntity.trim()) {
        sorted = sorted.filter((c) =>
          (c.entity_id || '').toLowerCase().includes(searchEntity.toLowerCase())
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
  }, [page, sortBy, stateFilter]);

  // anime.js staggered row entrance on cases update
  useEffect(() => {
    if (!loading && tableContainerRef.current && cases.length > 0) {
      anime({
        targets: tableContainerRef.current.querySelectorAll('.case-table-row'),
        opacity: [0, 1],
        translateY: [10, 0],
        easing: 'easeOutQuad',
        duration: 380,
        delay: anime.stagger(22),
      });
    }
  }, [cases, loading]);

  const handleTriggerDetection = async () => {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await apiClient.triggerDetection();
      setTriggerMsg(`Detection Engine Run Complete: ${res.anomalies_detected || 0} anomalies processed, ${res.cases_created_or_merged || 0} cases generated/updated.`);
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

  const severityColor: Record<CaseSeverity, string> = {
    [CaseSeverity.LOW]: '#10B981',
    [CaseSeverity.MEDIUM]: '#F59E0B',
    [CaseSeverity.HIGH]: '#F97316',
    [CaseSeverity.CRITICAL]: '#EF4444',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-foreground)' }}>Alert Queue</h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Real-time fraud anomaly queue and triage workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleTriggerDetection}
            disabled={triggering}
            variant="primary"
            size="sm"
            className="flex items-center gap-2 border text-white font-medium shadow-sm"
            style={{
              backgroundColor: '#8B5CF6',
              borderColor: '#7C3AED',
            }}
          >
            <RefreshCw size={14} className={triggering ? 'animate-spin' : ''} />
            {triggering ? 'Scanning Transactions...' : '⚡ Trigger Detection Engine'}
          </Button>
          <Button
            onClick={() => fetchCases(page)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border"
            style={{
              backgroundColor: 'var(--color-background-alt)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-foreground)'
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>
      </div>

      {triggerMsg && (
        <div className="rounded-lg border p-3 flex items-center justify-between" style={{
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderColor: 'rgba(139, 92, 246, 0.3)',
          color: '#A78BFA'
        }}>
          <p className="text-xs font-medium">{triggerMsg}</p>
          <button onClick={() => setTriggerMsg(null)} className="text-xs opacity-75 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Filter and Sort Controls */}
      <Card className="border" style={{
        backgroundColor: 'var(--color-background-alt)',
        borderColor: 'var(--color-border)'
      }}>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* State Filter Tabs */}
            <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--color-background-muted)' }}>
              {(['ALL', 'NEW', 'ESCALATED', 'RESOLVED'] as StateFilter[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setStateFilter(tab);
                    setPage(0);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    stateFilter === tab ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab === 'ALL' ? 'All Alerts' : tab}
                </button>
              ))}
            </div>

            <div className="flex flex-1 gap-3">
              <Input
                placeholder="Search card or entity ID..."
                value={searchEntity}
                onChange={(e) => {
                  setSearchEntity(e.target.value);
                  setPage(0);
                }}
                className="h-9 border flex-1"
                style={{
                  backgroundColor: 'var(--color-background-muted)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-foreground)'
                }}
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="rounded-md border px-3 py-1.5 text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--color-background-muted)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-foreground)'
                }}
              >
                <option value="sla">SLA (Urgent First)</option>
                <option value="created_at">Newest First</option>
                <option value="score">Highest Z-Score</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border p-3" style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.3)'
        }}>
          <p className="text-red-400 text-sm">Error: {error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="rounded-lg border p-6 text-center" style={{
          backgroundColor: 'var(--color-background-alt)',
          borderColor: 'var(--color-border)'
        }}>
          <div className="flex justify-center mb-3">
            <div className="h-6 w-6 rounded-full border-2 animate-spin" style={{
              borderColor: 'var(--color-border)',
              borderTopColor: 'var(--color-primary)'
            }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading alerts...</p>
        </div>
      )}

      {/* Cases Table */}
      {!loading && cases.length > 0 && (
        <Card className="border overflow-hidden shadow-xl" style={{
          backgroundColor: 'var(--color-background-alt)',
          borderColor: 'var(--color-border)'
        }}>
          <div ref={tableContainerRef} className="w-full overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10" style={{ backgroundColor: 'var(--color-background-muted)' }}>
                <TableRow style={{ borderBottomColor: 'var(--color-border)' }}>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Case ID</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Entity (Card)</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Z-Score</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Triage State</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>SLA Status</TableHead>
                  <TableHead className="text-right font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((caseRow) => (
                  <TableRow
                    key={caseRow.id}
                    className="case-table-row transition-colors cursor-pointer hover:bg-slate-900/60"
                    style={{ 
                      borderBottomColor: 'var(--color-border)',
                      backgroundColor: 'transparent'
                    }}
                  >
                    <TableCell className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{caseRow.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs" style={{ color: 'var(--color-foreground)' }}>{caseRow.entity_id}</TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold" style={{ color: severityColor[caseRow.severity] }}>
                        {caseRow.anomaly_score.toFixed(1)}σ
                      </span>
                    </TableCell>
                    <TableCell>
                      <StateBadge state={caseRow.state} />
                    </TableCell>
                    <TableCell>
                      <SLABadge createdAt={caseRow.created_at} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => handleCaseClick(caseRow.id)}
                        variant="primary"
                        size="sm"
                        className="h-9 px-4 text-xs text-white"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          opacity: 0.85
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.85'}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && cases.length === 0 && (
        <Card className="border" style={{
          backgroundColor: 'var(--color-background-alt)',
          borderColor: 'var(--color-border)'
        }}>
          <CardContent className="py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No alerts matching criteria.</p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Page {page + 1} of {totalPages} ({totalCases} total)
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => setPage(page - 1)}
              disabled={!canPrevPage}
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 border"
              style={{
                backgroundColor: 'var(--color-background-alt)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-foreground)'
              }}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              onClick={() => setPage(page + 1)}
              disabled={!canNextPage}
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 border"
              style={{
                backgroundColor: 'var(--color-background-alt)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-foreground)'
              }}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
