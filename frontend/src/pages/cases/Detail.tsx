/**
 * Case Detail Page
 * Full investigation view — anomalies, root causes, recommendations, audit trail
 * Uses design system CSS variables for dark mode OLED styling
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StateBadge } from '../../components/shared/StateBadge';
import { SLABadge } from '../../components/shared/SLABadge';
import { apiClient } from '../../lib/api';
import {
  CaseState,
  CaseSeverity,
  SLA_WINDOW_MS,
  SEVERITY_COLORS,
} from '../../lib/constants';
import { useAuth } from '../../hooks/useAuth';
import {
  ChevronLeft,
  Check,
  CheckCircle,
  AlertTriangle,
  Link as LinkIcon,
  Copy,
} from 'lucide-react';

interface Transaction {
  id: string;
  entity_id: string;
  merchant_id: string;
  amount: number;
  timestamp: string;
  mcc: string;
}

interface RootCauseLink {
  transaction_id: string;
  link_type: string;
  transaction: Transaction;
}

interface Recommendation {
  rule_id: string;
  recommendation_text: string;
  condition: any;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  changes?: any;
  created_at: string;
}

interface CaseDetailData {
  id: string;
  entity_id: string;
  anomaly_score: number;
  baseline_mean: number;
  baseline_stddev: number;
  state: CaseState;
  severity: CaseSeverity;
  created_at: string;
  version: number;
  related_anomalies: string[];
  evidence: {
    anomaly_ids: string[];
    root_causes: RootCauseLink[];
  };
  recommendations: Recommendation[];
  knowledge_base_entry?: {
    id: string;
    title: string;
  };
}

export const CaseDetail: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  useAuth();

  const [data, setData] = useState<CaseDetailData | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [slaRemaining, setSlaRemaining] = useState<number>(0);

  const fetchCaseDetail = async () => {
    if (!caseId) return;
    
    setLoading(true);
    setError(null);
    try {
      const caseData = await apiClient.getCaseDetail(caseId);
      setData(caseData);

      const auditData = await apiClient.getAuditLog('case', caseId);
      setAuditLog(auditData.entries || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load case detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // Update SLA countdown every second
  useEffect(() => {
    if (!data) return;

    const updateSla = () => {
      const elapsed = Date.now() - new Date(data.created_at).getTime();
      const remaining = Math.max(0, SLA_WINDOW_MS - elapsed);
      setSlaRemaining(remaining);
    };

    updateSla();
    const interval = setInterval(updateSla, 1000);
    return () => clearInterval(interval);
  }, [data]);

  if (!caseId) {
    return <div className="p-6" style={{ color: 'var(--color-error)' }}>Invalid case ID</div>;
  }

  const handleAccept = async () => {
    if (!data) return;
    setActingOn('accept');
    try {
      await apiClient.acceptCase(caseId, data.version, 'Reviewer acknowledged the case');
      setData({ ...data, state: CaseState.ACCEPTED });
      await fetchCaseDetail();
    } catch (err: any) {
      alert(`Accept failed: ${err.message}`);
    } finally {
      setActingOn(null);
    }
  };

  const handleResolve = async () => {
    if (!data) return;
    setActingOn('resolve');
    try {
      const rationale = window.prompt('Resolution rationale') || 'Reviewer accepted the recommended resolution';
      await apiClient.resolveCase(caseId, data.version, rationale);
      setData({ ...data, state: CaseState.RESOLVED });
      await fetchCaseDetail();
    } catch (err: any) {
      alert(`Resolve failed: ${err.message}`);
    } finally {
      setActingOn(null);
    }
  };

  const handleEscalate = async () => {
    if (!data) return;
    setActingOn('escalate');
    try {
      const reason = window.prompt('Escalation reason') || 'Reviewer needs Team Lead review for this case';
      await apiClient.escalateCase(caseId, data.version, reason);
      setData({ ...data, state: CaseState.ESCALATED });
      await fetchCaseDetail();
    } catch (err: any) {
      alert(`Escalate failed: ${err.message}`);
    } finally {
      setActingOn(null);
    }
  };

  const formatSLA = (ms: number): string => {
    if (ms <= 0) return 'SLA breached';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m left`;
  };

  const formatCurrency = (amount: number): string => `$${amount.toFixed(2)}`;
  const formatDate = (isoString: string): string =>
    new Date(isoString).toLocaleString();

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div style={{ color: 'var(--color-text-muted)' }}>Loading case detail...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div style={{ color: 'var(--color-error)' }}>{error || 'Case not found'}</div>
        <button
          className="mt-4 h-8 px-3 text-xs rounded-md border flex items-center gap-2"
          style={{
            backgroundColor: 'var(--color-background-alt)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
          onClick={() => navigate('/cases')}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Queue
        </button>
      </div>
    );
  }

  const isResolved = data.state === CaseState.RESOLVED;
  const isEscalated = data.state === CaseState.ESCALATED;
  const isNew = data.state === CaseState.NEW;
  const isAccepted = data.state === CaseState.ACCEPTED;

  const anomalyAmount =
    data.baseline_mean + data.anomaly_score * data.baseline_stddev;

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/cases')}
              className="h-8 w-8 rounded-md flex items-center justify-center transition-colors"
              style={{
                backgroundColor: 'var(--color-background-alt)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Case {data.id.slice(0, 12)}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <StateBadge state={data.state} />
            <div
              className="px-2 py-1 rounded text-xs font-medium text-slate-900"
              style={{ backgroundColor: SEVERITY_COLORS[data.severity] }}
            >
              {data.severity}
            </div>
            <SLABadge createdAt={data.created_at} />
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {formatDate(data.created_at)}
            </div>
            <div
              className="text-xs font-semibold"
              style={{
                color: slaRemaining > 3600000 ? 'var(--color-text-muted)' : 'var(--color-error)',
              }}
            >
              {formatSLA(slaRemaining)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isNew && (
            <button
              onClick={handleAccept}
              disabled={actingOn !== null}
              className="h-8 px-3 text-xs rounded-md font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: '#4F46E5',
                color: 'white',
              }}
            >
              {actingOn === 'accept' ? 'Accepting...' : 'Accept'}
            </button>
          )}
          {isAccepted && (
            <button
              onClick={handleResolve}
              disabled={actingOn !== null}
              className="h-8 px-3 text-xs rounded-md font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
              style={{
                backgroundColor: '#059669',
                color: 'white',
              }}
            >
              {actingOn === 'resolve' ? 'Resolving...' : (
                <>
                  <CheckCircle className="h-3 w-3" />
                  Resolve
                </>
              )}
            </button>
          )}
          {!isEscalated && (
            <button
              onClick={handleEscalate}
              disabled={actingOn !== null}
              className="h-8 px-3 text-xs rounded-md font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
              }}
            >
              {actingOn === 'escalate' ? 'Escalating...' : (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  Escalate
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* KB Link */}
      {isResolved && data.knowledge_base_entry && (
        <div
          className="rounded-lg border-l-4 p-4 flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.5)',
            borderLeftColor: '#10B981',
          }}
        >
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: '#86EFAC' }}
            >
              Knowledge Base
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {data.knowledge_base_entry.title}
            </div>
          </div>
          <button
            onClick={() => navigate(`/knowledge-base/${data.knowledge_base_entry!.id}`)}
            className="h-7 px-2 text-xs rounded-md font-medium transition-colors flex items-center gap-1"
            style={{
              backgroundColor: 'var(--color-background-muted)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <LinkIcon className="h-3 w-3" />
            View
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div
        className="flex gap-0 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {['overview', 'evidence', 'recommendations', 'audit'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-xs font-medium transition-colors border-b-2"
            style={{
              color:
                activeTab === tab
                  ? 'var(--color-primary)'
                  : 'var(--color-text-muted)',
              borderBottomColor:
                activeTab === tab
                  ? 'var(--color-primary)'
                  : 'transparent',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-3 mt-4">
            <div
              className="rounded-lg border p-4"
              style={{
                backgroundColor: 'var(--color-background-alt)',
                borderColor: 'var(--color-border)',
              }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Anomaly Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div
                  className="p-3 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-background-muted)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    Entity
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {data.entity_id}
                  </div>
                  <button
                    className="mt-2 text-xs flex items-center gap-1 transition-colors"
                    style={{ color: 'var(--color-primary)' }}
                    onClick={() => navigator.clipboard.writeText(data.entity_id)}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>

                <div
                  className="p-3 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-background-muted)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    Amount
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(anomalyAmount)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {data.anomaly_score.toFixed(2)}σ
                  </div>
                </div>

                <div
                  className="p-3 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-background-muted)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    Baseline Mean
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(data.baseline_mean)}
                  </div>
                </div>

                <div
                  className="p-3 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-background-muted)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    Baseline σ
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(data.baseline_stddev)}
                  </div>
                </div>
              </div>

              {data.related_anomalies.length > 0 && (
                <div
                  className="border-t mt-4 pt-4"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Related Anomalies
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.related_anomalies.map((anomalyId) => (
                      <div
                        key={anomalyId}
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: 'var(--color-background-muted)',
                          borderColor: 'var(--color-border)',
                          border: '1px solid',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {anomalyId.slice(0, 8)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Evidence Tab */}
        {activeTab === 'evidence' && (
          <div className="space-y-3 mt-4">
            <div
              className="rounded-lg border p-4"
              style={{
                backgroundColor: 'var(--color-background-alt)',
                borderColor: 'var(--color-border)',
              }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Root Cause Links
              </h3>
              {data.evidence.root_causes.length > 0 ? (
                <div className="space-y-2">
                  {data.evidence.root_causes.map((link, idx) => (
                    <div
                      key={idx}
                      className="border rounded-lg p-3"
                      style={{
                        backgroundColor: 'var(--color-background-muted)',
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          {link.link_type}
                        </div>
                        <div
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: 'var(--color-background)',
                            borderColor: 'var(--color-border)',
                            border: '1px solid',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          {link.transaction_id.slice(0, 8)}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <div style={{ color: 'var(--color-text-muted)' }}>Entity</div>
                          <div className="font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                            {link.transaction.entity_id}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--color-text-muted)' }}>Amount</div>
                          <div className="font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                            {formatCurrency(link.transaction.amount)}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--color-text-muted)' }}>Time</div>
                          <div className="font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                            {formatDate(link.transaction.timestamp).slice(0, 16)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  No root cause links
                </p>
              )}
            </div>
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-3 mt-4">
            <div
              className="rounded-lg border p-4"
              style={{
                backgroundColor: 'var(--color-background-alt)',
                borderColor: 'var(--color-border)',
              }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Matching Rules
              </h3>
              {data.recommendations.length > 0 ? (
                <div className="space-y-2">
                  {data.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="border rounded-lg p-3 flex items-start gap-2"
                      style={{
                        backgroundColor: 'var(--color-background-muted)',
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-success)' }} />
                      <div className="flex-1">
                        <div className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          {rec.recommendation_text}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                          {rec.rule_id}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  No recommendations
                </p>
              )}
            </div>
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-3 mt-4">
            <div
              className="rounded-lg border p-4"
              style={{
                backgroundColor: 'var(--color-background-alt)',
                borderColor: 'var(--color-border)',
              }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Audit Trail
              </h3>
              {auditLog.length > 0 ? (
                <div className="space-y-2">
                  {auditLog.map((entry, idx) => (
                    <div
                      key={idx}
                      className="border rounded-lg p-3 flex items-start gap-3"
                      style={{
                        backgroundColor: 'var(--color-background-muted)',
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      <div
                        className="flex-shrink-0 h-1.5 w-1.5 rounded-full mt-1.5"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                              [{entry.action}]
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                              {entry.actor}
                            </div>
                          </div>
                          <div className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                            {formatDate(entry.created_at).slice(0, 16)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  No audit entries
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseDetail;
