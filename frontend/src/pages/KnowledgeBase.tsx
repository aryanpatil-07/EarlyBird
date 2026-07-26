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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">
          Knowledge Base
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Search resolved cases and learn from historical patterns
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by pattern, merchant, entity, or rule..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-base border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          {loading && (
            <Loader className="absolute right-3 top-3 h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {query.trim() ? (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {loading ? (
              'Searching...'
            ) : results.length > 0 ? (
              `Found ${total} ${total === 1 ? 'result' : 'results'}`
            ) : (
              'No results found'
            )}
          </div>

          {/* Results List */}
          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((entry) => {
                const isExpanded = expandedEntryId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden"
                  >
                    {/* Entry Header (always visible) */}
                    <div
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <h3 className="font-semibold text-gray-900 dark:text-gray-50 truncate">
                              {entry.title}
                            </h3>
                          </div>

                          {/* Description Preview */}
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                            {entry.description}
                          </p>

                          {/* Meta (compact on collapsed) */}
                          <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 dark:text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>Resolved {formatDate(entry.created_at)}</span>
                            </div>
                            {entry.resolved_case_id && (
                              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <LinkIcon className="h-3 w-3" />
                                <span>Case {entry.resolved_case_id}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expand Arrow */}
                        <ChevronDown
                          className={`h-5 w-5 text-gray-400 dark:text-gray-600 flex-shrink-0 mt-1 transition-transform ${
                            isExpanded ? 'transform rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-800/50 space-y-4">
                        {/* Full Description */}
                        <div>
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase mb-2">
                            Full Description
                          </div>
                          <p className="text-sm text-gray-900 dark:text-gray-50 whitespace-pre-wrap leading-relaxed">
                            {entry.description}
                          </p>
                        </div>

                        {/* Entry ID */}
                        <div>
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase mb-2">
                            Entry ID
                          </div>
                          <div className="text-sm font-mono text-gray-900 dark:text-gray-50 bg-gray-100 dark:bg-gray-900 p-2 rounded">
                            {entry.id}
                          </div>
                        </div>

                        {/* Tags */}
                        {entry.tags && entry.tags.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase mb-2">
                              Tags
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 rounded-full text-xs font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Related Case Link */}
                        {entry.resolved_case_id && (
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                            <div className="text-sm font-medium text-emerald-900 dark:text-emerald-300 flex items-center gap-2 mb-3">
                              <LinkIcon className="h-4 w-4" />
                              Related Case
                            </div>
                            <div className="text-sm text-emerald-800 dark:text-emerald-400 font-mono mb-3">
                              Case {entry.resolved_case_id}
                            </div>
                            <button
                              onClick={() => {
                                navigate(`/cases/${entry.resolved_case_id}`);
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 rounded-md hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                            >
                              <ChevronRight className="h-4 w-4" />
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
            <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => handlePaginate(page - 1)}
                disabled={page === 1 || loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </div>
              <button
                onClick={() => handlePaginate(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Load More / No More Results */}
          {totalPages <= 1 && results.length > 0 && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-500 py-4">
              End of results
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 py-16 text-center">
          <FileText className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            Start typing to search the knowledge base
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Search for patterns, merchant names, entity IDs, or detection rules
          </p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
