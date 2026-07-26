/**
 * Case Queue Page
 * Triage interface — show NEW/ACCEPTED cases in priority order
 * Sort by: SLA approaching (<1h), newest first, highest z-score
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

export const CaseQueue: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>('sla');
  const [searchEntity, setSearchEntity] = useState('');

  const fetchCases = async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getCases({
        state: 'NEW,ACCEPTED',
        limit: DEFAULT_PAGE_SIZE,
        offset: currentPage * DEFAULT_PAGE_SIZE,
      });

      const data = response as CasesResponse;
      let sorted = [...data.cases];

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
        sorted.sort((a, b) => b.anomaly_score - a.anomaly_score);
      }

      // Filter by entity if search is active
      if (searchEntity.trim()) {
        sorted = sorted.filter((c) =>
          c.entity_id.toLowerCase().includes(searchEntity.toLowerCase())
        );
      }

      setCases(sorted);
      setTotalCases(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases(page);
  }, [page, sortBy]);

  const handleCaseClick = (caseId: string) => {
    navigate(`/cases/${caseId}`);
  };

  const totalPages = Math.ceil(totalCases / DEFAULT_PAGE_SIZE);
  const canPrevPage = page > 0;
  const canNextPage = page < totalPages - 1;

  const severityColor: Record<CaseSeverity, string> = {
    [CaseSeverity.LOW]: 'text-green-400',
    [CaseSeverity.MEDIUM]: 'text-amber-400',
    [CaseSeverity.HIGH]: 'text-orange-400',
    [CaseSeverity.CRITICAL]: 'text-red-400',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-semibold text-gray-100">Alert Queue</h1>
        <Button
          onClick={() => fetchCases(page)}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border-slate-600"
        >
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {/* Filter and Sort Controls */}
      <Card className="bg-slate-800/40 border-slate-700/60">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search entity ID..."
                value={searchEntity}
                onChange={(e) => {
                  setSearchEntity(e.target.value);
                  setPage(0);
                }}
                className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-500 h-9"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="rounded-md border border-slate-600 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-100 hover:border-slate-500 transition-colors"
            >
              <option value="sla">SLA (Urgent)</option>
              <option value="created_at">Newest</option>
              <option value="score">Score</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3">
          <p className="text-rose-300 text-sm">Error: {error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 p-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="h-6 w-6 rounded-full border-2 border-slate-500/30 border-t-slate-400 animate-spin" />
          </div>
          <p className="text-slate-400 text-sm">Loading alerts...</p>
        </div>
      )}

      {/* Cases Table */}
      {!loading && cases.length > 0 && (
        <Card className="bg-slate-800/30 border-slate-700/60 overflow-hidden">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-900/40 sticky top-0 z-10">
                <TableRow className="border-slate-700/40 hover:bg-transparent">
                  <TableHead className="text-slate-300 font-semibold text-xs">ID</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">Entity</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">Score</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">State</TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">SLA</TableHead>
                  <TableHead className="text-right text-slate-300 font-semibold text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((caseRow) => (
                  <TableRow
                    key={caseRow.id}
                    className="border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer"
                  >
                    <TableCell className="font-mono text-xs text-slate-200">{caseRow.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs text-slate-300">{caseRow.entity_id}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold ${severityColor[caseRow.severity]}`}>
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
                        className="h-9 px-4 text-xs bg-indigo-600/70 hover:bg-indigo-600 text-white"
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
        <Card className="bg-slate-800/30 border-slate-700/60">
          <CardContent className="py-10 text-center">
            <p className="text-slate-400 text-sm">No alerts matching criteria.</p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-500">
            Page {page + 1} of {totalPages} ({totalCases} total)
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => setPage(page - 1)}
              disabled={!canPrevPage}
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border-slate-600"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              onClick={() => setPage(page + 1)}
              disabled={!canNextPage}
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border-slate-600"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
