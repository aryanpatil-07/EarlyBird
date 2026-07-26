/**
 * Knowledge Base Search
 * Full-text search for resolved cases and KB entries
 * 
 * Features:
 * - Debounced search input (real-time results)
 * - Paginated results (10 per page)
 * - Inline expandable detail view (no modal)
 * - Click-through to related case
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { ChevronRight, ChevronDown, Search, Loader, FileText, Calendar, Link as LinkIcon } from 'lucide-react';

interface KBEntry {
  id: string;
  title: string;
  description: string;
  resolved_case_id?: string;
  created_at: string;
  tags?: string[];
}

interface SearchResponse {
  entries: KBEntry[];
  total: number;
  page: number;
  per_page: number;
}

export const KnowledgeBase: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KBEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch(query, 1);
      } else {
        setResults([]);
        setTotal(0);
        setPage(1);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = useCallback(async (searchQuery: string, pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = (pageNum - 1) * perPage;
      const response = await apiClient.searchKB(searchQuery, perPage, offset);
      
      const data = response as SearchResponse;
      setResults(data.entries || []);
      setTotal(data.total || 0);
      setPage(data.page || pageNum);
    } catch (err: any) {
      setError(err.message || 'Failed to search knowledge base');
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [perPage]);

  const handlePaginate = (newPage: number) => {
    if (query.trim()) {
      performSearch(query, newPage);
    }
  };

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4 p-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-100 mb-1">
          Knowledge Base
        </h1>
        <p className="text-xs text-slate-400">
          Search resolved cases and historical patterns
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-slate-800/30 rounded-lg border border-slate-700/60 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by pattern, merchant, entity..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-700 rounded-md bg-slate-900/50 text-slate-100 placeholder-slate-500 hover:border-slate-600 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
          />
          {loading && (
            <Loader className="absolute right-2.5 top-2.5 h-4 w-4 text-indigo-500 animate-spin" />
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-lg p-3">
          <p className="text-rose-300 text-xs">{error}</p>
        </div>
      )}

      {/* Results */}
      {query.trim() ? (
        <div className="space-y-3">
          {/* Results Header */}
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {loading ? (
              'Searching...'
            ) : results.length > 0 ? (
              `${total} ${total === 1 ? 'result' : 'results'}`
            ) : (
              'No results'
            )}
          </div>

          {/* Results List */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((entry) => {
                const isExpanded = expandedEntryId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="bg-slate-800/30 rounded-lg border border-slate-700/60 overflow-hidden"
                  >
                    {/* Entry Header (always visible) */}
                    <div
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      className="p-3 cursor-pointer hover:bg-slate-700/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                            <h3 className="font-semibold text-slate-100 truncate text-sm">
                              {entry.title}
                            </h3>
                          </div>

                          {/* Description Preview */}
                          <p className="text-xs text-slate-400 mb-2 line-clamp-1">
                            {entry.description}
                          </p>

                          {/* Meta */}
                          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(entry.created_at)}</span>
                            </div>
                            {entry.resolved_case_id && (
                              <div className="flex items-center gap-1 text-indigo-400">
                                <LinkIcon className="h-3 w-3" />
                                <span>{entry.resolved_case_id.slice(0, 8)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expand Arrow */}
                        <ChevronDown
                          className={`h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5 transition-transform ${
                            isExpanded ? 'transform rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-700/40 p-3 bg-slate-900/30 space-y-3">
                        {/* Full Description */}
                        <div>
                          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                            Details
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {entry.description.substring(0, 300)}
                          </p>
                        </div>

                        {/* Tags */}
                        {entry.tags && entry.tags.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                              Tags
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-block px-2 py-0.5 bg-indigo-950/40 text-indigo-300 rounded text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Related Case Link */}
                        {entry.resolved_case_id && (
                          <div className="bg-green-950/20 border border-green-600/30 rounded p-2">
                            <button
                              onClick={() => {
                                navigate(`/cases/${entry.resolved_case_id}`);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-green-300 bg-green-600/20 rounded hover:bg-green-600/30 transition-colors"
                            >
                              <LinkIcon className="h-3 w-3" />
                              View Case
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-slate-700/40">
              <button
                onClick={() => handlePaginate(page - 1)}
                disabled={page === 1 || loading}
                className="px-3 py-1 text-xs font-medium text-slate-300 bg-slate-800/50 border border-slate-600 rounded hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              <div className="text-xs text-slate-500">
                {page} / {totalPages}
              </div>
              <button
                onClick={() => handlePaginate(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-1 text-xs font-medium text-slate-300 bg-slate-800/50 border border-slate-600 rounded hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-800/20 rounded-lg border border-dashed border-slate-700/40 py-12 text-center">
          <FileText className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">
            Start typing to search
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Patterns, merchants, entities, rules
          </p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
