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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-50">Cases Queue</h1>
        <Button
          onClick={() => fetchCases(page)}
          variant="outline"
          size="md"
          className="flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      {/* Filter and Sort Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by entity ID..."
                value={searchEntity}
                onChange={(e) => {
                  setSearchEntity(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="rounded-md border border-gray-400 bg-gray-900 px-3 py-2 text-sm text-gray-100"
              >
                <option value="sla">Sort: SLA (Urgent First)</option>
                <option value="created_at">Sort: Newest First</option>
                <option value="score">Sort: Highest Score</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-500 bg-red-900/20 p-4">
          <p className="text-red-200">Error: {error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center">
          <p className="text-gray-300">Loading cases...</p>
        </div>
      )}

      {/* Cases Table */}
      {!loading && cases.length > 0 && (
        <Card>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case ID</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Anomaly Score</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>SLA Remaining</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((caseRow) => (
                  <TableRow
                    key={caseRow.id}
                    className="cursor-pointer hover:bg-gray-700/50"
                  >
                    <TableCell className="font-mono font-semibold">{caseRow.id}</TableCell>
                    <TableCell>{caseRow.entity_id}</TableCell>
                    <TableCell>
                      <span className={severityColor[caseRow.severity]}>
                        {caseRow.anomaly_score.toFixed(2)} σ
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
                      >
                        View
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
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">No cases found matching your criteria.</p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Page {page + 1} of {totalPages} ({totalCases} total cases)
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => setPage(page - 1)}
              disabled={!canPrevPage}
              variant="outline"
              size="sm"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              onClick={() => setPage(page + 1)}
              disabled={!canNextPage}
              variant="outline"
              size="sm"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
