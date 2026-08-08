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
      performSearch(query, 1);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = useCallback(async (searchQuery: string, pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = (pageNum - 1) * perPage;
      const response = await apiClient.searchKB(searchQuery, perPage, offset);
      
      const itemsList = response.items || response.entries || [];
      setResults(itemsList);
      setTotal(response.total || itemsList.length);
      setPage(response.page || pageNum);
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
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
          Knowledge Base
        </h1>
        <p className="text-xs text-slate-400">
          Full-text neural search across auto-generated precedent cases and historical patterns
        </p>
      </div>

      {/* Search Input */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#111218] p-3 shadow-lg">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by pattern, merchant ID, entity card, or precedent..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl bg-[#08090C] border border-white/[0.06] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
          {loading && (
            <Loader className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-violet-400" />
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border p-3" style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.3)'
        }}>
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Results */}
      {query.trim() ? (
        <div className="space-y-3">
          {/* Results Header */}
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
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
                    className="rounded-lg border overflow-hidden"
                    style={{
                      backgroundColor: 'var(--color-background-alt)',
                      borderColor: 'var(--color-border)'
                    }}
                  >
                    {/* Entry Header (always visible) */}
                    <div
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      className="p-3 cursor-pointer transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                            <h3 className="font-semibold truncate text-sm" style={{ color: 'var(--color-foreground)' }}>
                              {entry.title}
                            </h3>
                          </div>

                          {/* Description Preview */}
                          <p className="text-xs mb-2 line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>
                            {entry.description}
                          </p>

                          {/* Meta */}
                          <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(entry.created_at)}</span>
                            </div>
                            {entry.resolved_case_id && (
                              <div className="flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                                <LinkIcon className="h-3 w-3" />
                                <span>{entry.resolved_case_id.slice(0, 8)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expand Arrow */}
                        <ChevronDown
                          className={`h-4 w-4 flex-shrink-0 mt-0.5 transition-transform`}
                          style={{ 
                            color: 'var(--color-text-muted)',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                          }}
                        />
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t space-y-3 p-3" style={{
                        backgroundColor: 'var(--color-background-muted)',
                        borderTopColor: 'var(--color-border)'
                      }}>
                        {/* Full Description */}
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
                            Details
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                            {entry.description.substring(0, 300)}
                          </p>
                        </div>

                        {/* Tags */}
                        {entry.tags && entry.tags.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
                              Tags
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-block px-2 py-0.5 rounded text-xs"
                                  style={{
                                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                    color: 'var(--color-accent-light)'
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Related Case Link */}
                        {entry.resolved_case_id && (
                          <div className="rounded p-2" style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}>
                            <button
                              onClick={() => {
                                navigate(`/cases/${entry.resolved_case_id}`);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors"
                              style={{
                                color: 'var(--color-success)',
                                backgroundColor: 'rgba(16, 185, 129, 0.2)'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.3)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'}
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
            <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t" style={{ borderTopColor: 'var(--color-border)' }}>
              <button
                onClick={() => handlePaginate(page - 1)}
                disabled={page === 1 || loading}
                className="px-3 py-1 text-xs font-medium rounded transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-background-alt)',
                  borderColor: 'var(--color-border)'
                }}
              >
                Prev
              </button>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {page} / {totalPages}
              </div>
              <button
                onClick={() => handlePaginate(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-1 text-xs font-medium rounded transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-background-alt)',
                  borderColor: 'var(--color-border)'
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-lg border-2 border-dashed py-12 text-center" style={{
          backgroundColor: 'var(--color-background-muted)',
          borderColor: 'var(--color-border)'
        }}>
          <FileText className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Start typing to search
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Patterns, merchants, entities, rules
          </p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
