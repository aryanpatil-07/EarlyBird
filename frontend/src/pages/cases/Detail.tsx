/**
 * Case Detail Page
 * Full investigation view — anomalies, root causes, recommendations, audit trail
 * Uses design system CSS variables for dark mode OLED styling
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import anime from 'animejs';
import { StateBadge } from '../../components/shared/StateBadge';
import { SLABadge } from '../../components/shared/SLABadge';
import { apiClient } from '../../lib/api';
import {
  CaseState,
  CaseSeverity,
  SLA_WINDOW_MS,
  SEVERITY_COLORS,
} from '../../lib/constants';
import { useAuth } from '../../context/AuthContext';
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
  reason?: string;
  changes?: any;
  created_at: string;
}

interface DecisionSummary {
  action: string;
  actor: string;
  actor_name: string;
  created_at: string;
  category?: string;
  verification_methods?: string[];
  follow_up_action?: string;
  rationale?: string;
}

interface CaseDetailData {
  id: string;
  case_id?: string;
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
  decision_summary?: DecisionSummary;
  knowledge_base_entry?: {
    id: string;
    title: string;
  };
}

const CLASSIFICATION_OPTIONS = [
  { value: 'CARD_NOT_PRESENT_FRAUD', label: 'Card-Not-Present (CNP) e-Commerce Anomaly' },
  { value: 'VELOCITY_BURST', label: 'Rapid High-Frequency Transaction Burst' },
  { value: 'ACCOUNT_TAKEOVER', label: 'Compromised Credentials / Account Takeover' },
  { value: 'MERCHANT_TERMINAL_COMPROMISE', label: 'Compromised Terminal / High-Risk Merchant' },
  { value: 'GEOGRAPHIC_IMPOSSIBILITY', label: 'Geographic Impossibility / IP Conflict' },
  { value: 'LEGITIMATE_HIGH_VALUE', label: 'Verified Authorized Luxury / High-Ticket Purchase' },
  { value: 'CARDHOLDER_TRAVEL', label: 'Verified Domestic / International Cardholder Travel' },
  { value: 'BENIGN_RECURRING_BILLING', label: 'Benign Scheduled / Subscription Billing' },
];

const VERIFICATION_METHODS_OPTIONS = [
  'Cardholder Phone / SMS Verification',
  'IP & Geolocation Match Checked',
  'Device & Browser Fingerprint Analyzed',
  'Merchant 3D-Secure / EMV Verified',
  'EWMA Rolling Velocity Baseline Analyzed',
  'Historical Merchant Spending Pattern Match',
];

const FOLLOW_UP_OPTIONS = [
  { value: 'BLOCK_AND_REISSUE', label: 'Block Card & Reissue New Card' },
  { value: 'ADD_MERCHANT_WATCHLIST', label: 'Add Merchant to Automated Watchlist' },
  { value: 'TUNE_PLAYBOOK_RULE', label: 'Tune Playbook Rule Threshold' },
  { value: 'MARK_TRUSTED_BASELINE', label: 'Mark Entity as Trusted Baseline' },
  { value: 'NO_ACTION_REQUIRED', label: 'No Operational Follow-up Required' },
];

export const CaseDetail: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<CaseDetailData | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [slaRemaining, setSlaRemaining] = useState<number>(0);

  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  const [decision, setDecision] = useState<'ACCEPTED' | 'REJECTED' | 'MODIFIED'>('ACCEPTED');
  const [category, setCategory] = useState<string>('CARD_NOT_PRESENT_FRAUD');
  const [selectedVerificationMethods, setSelectedVerificationMethods] = useState<string[]>([
    'Cardholder Phone / SMS Verification',
    'EWMA Rolling Velocity Baseline Analyzed',
  ]);
  const [followUpAction, setFollowUpAction] = useState<string>('NO_ACTION_REQUIRED');
  const [rationale, setRationale] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const toggleVerificationMethod = (method: string) => {
    setSelectedVerificationMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const fetchCaseDetail = async () => {
    if (!caseId) return;
    
    setLoading(true);
    setError(null);
    try {
      const caseData = await apiClient.getCaseDetail(caseId);
      setData(caseData);

      const auditData = await apiClient.getAuditLog({ entity_type: 'case', entity_id: caseId });
      setAuditLog(auditData.entries || auditData.items || []);
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

  // anime.js spring dialog opening
  useEffect(() => {
    if (isActionModalOpen || isEscalateModalOpen) {
      anime({
        targets: '.triage-modal-dialog',
        scale: [0.93, 1],
        opacity: [0, 1],
        easing: 'easeOutQuart',
        duration: 320,
      });
    }
  }, [isActionModalOpen, isEscalateModalOpen]);

  if (!caseId) {
    return <div className="p-6" style={{ color: 'var(--color-error)' }}>Invalid case ID</div>;
  }

  const handleActionSubmit = async () => {
    if (!data) return;
    setModalError(null);
    if ((decision === 'REJECTED' || decision === 'MODIFIED') && !rationale.trim()) {
      setModalError(`Rationale is required for ${decision} decision`);
      return;
    }
    setActingOn('action');
    try {
      await apiClient.actOnCase(caseId, data.version, decision, rationale);
      setIsActionModalOpen(false);
      setRationale('');
      await fetchCaseDetail();
    } catch (err: any) {
      if (err.status === 409 || err.code === 'STALE_CASE_STATE') {
        setIsActionModalOpen(false);
        setIsConflictModalOpen(true);
      } else {
        setModalError(err.message || 'Action failed');
      }
    } finally {
      setActingOn(null);
    }
  };

  const handleEscalateSubmit = async () => {
    if (!data) return;
    setModalError(null);
    if (escalateReason.trim().length < 10) {
      setModalError('Escalation reason must be at least 10 characters');
      return;
    }
    setActingOn('escalate');
    try {
      await apiClient.escalateCase(caseId, data.version, escalateReason);
      setIsEscalateModalOpen(false);
      setEscalateReason('');
      await fetchCaseDetail();
    } catch (err: any) {
      if (err.status === 409 || err.code === 'STALE_CASE_STATE') {
        setIsEscalateModalOpen(false);
        setIsConflictModalOpen(true);
      } else {
        setModalError(err.message || 'Escalation failed');
      }
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
        <div className="flex gap-2.5">
          {!isResolved && (
            <button
              onClick={() => { setModalError(null); setIsActionModalOpen(true); }}
              disabled={actingOn !== null}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Take Decision</span>
            </button>
          )}
          {!isEscalated && !isResolved && user?.role !== 'TEAM_LEAD' && (
            <button
              onClick={() => { setModalError(null); setIsEscalateModalOpen(true); }}
              disabled={actingOn !== null}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Escalate</span>
            </button>
          )}
        </div>
      </div>

      {/* Investigation Documentation & Resolution Summary Card */}
      {data.decision_summary && (
        <div
          className="rounded-2xl border p-6 shadow-xl space-y-4 bg-[#111218] border-white/[0.06]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.state === CaseState.RESOLVED ? '#10B981' : (data.state === CaseState.ESCALATED ? '#F59E0B' : '#38BDF8') }} />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Investigation Documentation & Resolution Record
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                {data.decision_summary.action}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>Investigator: <strong className="text-slate-200">{data.decision_summary.actor_name}</strong></span>
              {data.decision_summary.created_at && (
                <span>• {new Date(data.decision_summary.created_at).toLocaleString()}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-[#0B0C10] border border-white/[0.04]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fraud / Anomaly Classification</div>
              <div className="text-xs font-semibold mt-1 text-sky-300">
                {CLASSIFICATION_OPTIONS.find(c => c.value === data.decision_summary?.category)?.label || data.decision_summary.category || 'Card-Not-Present (CNP) e-Commerce Anomaly'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0C10] border border-white/[0.04] md:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Verification Methods Applied</div>
              <div className="flex flex-wrap gap-1.5">
                {data.decision_summary.verification_methods && data.decision_summary.verification_methods.length > 0 ? (
                  data.decision_summary.verification_methods.map((method, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <Check className="h-3 w-3" />
                      {method}
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <Check className="h-3 w-3" />
                    EWMA Rolling Velocity Baseline Analyzed
                  </span>
                )}
              </div>
            </div>
          </div>

          {data.decision_summary.follow_up_action && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Recommended Follow-up Action:</span>
              <span className="px-2.5 py-0.5 rounded-full font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30">
                {FOLLOW_UP_OPTIONS.find(f => f.value === data.decision_summary?.follow_up_action)?.label || data.decision_summary.follow_up_action}
              </span>
            </div>
          )}

          {data.decision_summary.rationale && (
            <div className="p-3.5 rounded-xl bg-[#0B0C10] border border-white/[0.04]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Audited Investigation Rationale & Operational Notes
              </div>
              <p className="text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                {data.decision_summary.rationale}
              </p>
            </div>
          )}
        </div>
      )}

      {/* KB Link */}
      {isResolved && data.knowledge_base_entry && (
        <div className="rounded-2xl border p-4 flex items-center justify-between bg-emerald-950/20 border-emerald-500/30">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Auto-Generated Knowledge Base Precedent
            </div>
            <div className="text-sm mt-1 font-semibold text-slate-100">
              {data.knowledge_base_entry.title}
            </div>
          </div>
          <button
            onClick={() => {
              if (data.knowledge_base_entry?.id) {
                navigate(`/knowledge-base/${data.knowledge_base_entry.id}`);
              } else {
                navigate(`/knowledge-base?case=${data.id || caseId || ''}`);
              }
            }}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#12131A] hover:bg-[#181A24] text-slate-200 border border-white/[0.08] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            <span>View in KB</span>
          </button>
        </div>
      )}

      {/* Tab Navigation (Pill container) */}
      <div className="p-1 rounded-xl bg-[#111218] border border-white/[0.06] inline-flex gap-1">
        {['overview', 'evidence', 'recommendations', 'audit'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div
                  className="p-3 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-background-muted)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    Entity (Card)
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {data.entity_id}
                  </div>
                  <button
                    className="mt-2 text-xs flex items-center gap-1 transition-colors cursor-pointer"
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
                    Transaction Amount
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(anomalyAmount)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Z-Score: {data.anomaly_score.toFixed(2)}σ
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
                    Rolling Baseline Mean
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(data.baseline_mean)}
                  </div>
                  <div className="text-xs mt-1 text-slate-400">
                    StdDev: ±{formatCurrency(data.baseline_stddev)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Evidence Tab */}
        {activeTab === 'evidence' && (
          <div className="space-y-4 mt-4">
            <div
              className="rounded-lg border p-4"
              style={{
                backgroundColor: 'var(--color-background-alt)',
                borderColor: 'var(--color-border)',
              }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-primary)' }}>
                Correlated Root Cause Timeline
              </h3>
              {data.evidence && data.evidence.root_causes && data.evidence.root_causes.length > 0 ? (
                <div className="space-y-3">
                  {data.evidence.root_causes.map((rc, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      style={{
                        backgroundColor: 'var(--color-background-muted)',
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      <div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                          {rc.link_type}
                        </span>
                        <div className="text-xs text-slate-300 mt-1.5 font-medium">
                          Transaction ID: {rc.transaction_id}
                        </div>
                      </div>
                      {rc.transaction && (
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-100">
                            {formatCurrency(rc.transaction.amount || 0)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Merchant: {rc.transaction.merchant_id || 'N/A'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No correlated transactions found for this card.</p>
              )}
            </div>
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4 mt-4">
            <div
              className="rounded-lg border p-4"
              style={{
                backgroundColor: 'var(--color-background-alt)',
                borderColor: 'var(--color-border)',
              }}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-primary)' }}>
                Matching Playbook Rules & Automated Recommendations
              </h3>
              {data.recommendations && data.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {data.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg border border-purple-500/30 bg-purple-950/20"
                    >
                      <div className="text-xs font-bold text-purple-300">
                        Rule: {rec.rule_id}
                      </div>
                      <div className="text-xs text-slate-200 mt-1">
                        {rec.recommendation_text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No specific playbook rules matched this anomaly pattern.</p>
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
                Forensic Audit Trail & Decision Logs
              </h3>
              {auditLog.length > 0 ? (
                <div className="space-y-3">
                  {auditLog.map((entry, idx) => (
                    <div
                      key={idx}
                      className="border rounded-lg p-3.5 space-y-2"
                      style={{
                        backgroundColor: 'var(--color-background-muted)',
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                            [{entry.action}]
                          </span>
                          <span className="text-xs font-medium text-slate-300">
                            Actor: {entry.actor === '2' ? 'Team Lead Sarah' : (entry.actor === '1' ? 'Reviewer Alex' : entry.actor)}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>

                      {entry.changes && (
                        <div className="text-xs space-y-1 text-slate-300 pt-1 border-t border-slate-800">
                          {entry.changes.category && (
                            <div>
                              <span className="text-slate-500">Category: </span>
                              <span className="text-indigo-300 font-medium">
                                {CLASSIFICATION_OPTIONS.find(c => c.value === entry.changes.category)?.label || entry.changes.category}
                              </span>
                            </div>
                          )}
                          {entry.changes.verification_methods && entry.changes.verification_methods.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center mt-1">
                              <span className="text-slate-500">Verifications: </span>
                              {entry.changes.verification_methods.map((m: string, mIdx: number) => (
                                <span key={mIdx} className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ✓ {m}
                                </span>
                              ))}
                            </div>
                          )}
                          {entry.changes.follow_up_action && (
                            <div>
                              <span className="text-slate-500">Action: </span>
                              <span className="text-purple-300">
                                {FOLLOW_UP_OPTIONS.find(f => f.value === entry.changes.follow_up_action)?.label || entry.changes.follow_up_action}
                              </span>
                            </div>
                          )}
                          {entry.changes.note && (
                            <div className="mt-1 p-2 rounded bg-slate-950/50 text-slate-200">
                              <span className="text-slate-500 block mb-0.5">Rationale:</span>
                              {entry.changes.note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No audit entries recorded.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Structured Action Decision Modal */}
      {isActionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="triage-modal-dialog w-full max-w-xl rounded-xl border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--color-background-alt)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h3 className="text-lg font-bold">Investigation & Triage Decision Form</h3>
                <p className="text-xs text-slate-400">Complete structured documentation for audit compliance and knowledge generation</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                Actor: {user?.role === 'TEAM_LEAD' ? 'Team Lead (Sarah)' : 'Reviewer (Alex)'}
              </span>
            </div>

            {modalError && (
              <div className="p-3 rounded text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                {modalError}
              </div>
            )}

            {/* Decision Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">1. Operational Decision</label>
              <div className="grid grid-cols-3 gap-2">
                {(['ACCEPTED', 'REJECTED', 'MODIFIED'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDecision(opt)}
                    className={`py-2 text-xs rounded-lg font-semibold border transition-all cursor-pointer ${
                      decision === opt
                        ? (opt === 'ACCEPTED' ? 'border-emerald-500 bg-emerald-600/25 text-emerald-300 shadow' : 'border-indigo-500 bg-indigo-600/25 text-indigo-300 shadow')
                        : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt === 'ACCEPTED' ? '✓ Accept (Legit)' : (opt === 'REJECTED' ? '✗ Reject (Fraud)' : '⚡ Modify / Custom')}
                  </button>
                ))}
              </div>
            </div>

            {/* Classification Dropdown */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">2. Fraud / Anomaly Classification</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 text-xs rounded-lg border bg-slate-900/80 border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {CLASSIFICATION_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Verification Methods Checklist */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">3. Verification Methods Applied (Check all that apply)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VERIFICATION_METHODS_OPTIONS.map((method) => {
                  const isChecked = selectedVerificationMethods.includes(method);
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => toggleVerificationMethod(method)}
                      className={`p-2 text-left text-xs rounded-lg border transition-all flex items-center gap-2 cursor-pointer ${
                        isChecked
                          ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-200 font-medium'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${isChecked ? 'bg-emerald-600 text-white' : 'border border-slate-700 bg-slate-800'}`}>
                        {isChecked ? '✓' : ''}
                      </span>
                      <span className="truncate">{method}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Follow-up Action */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">4. Recommended Follow-up Action</label>
              <select
                value={followUpAction}
                onChange={(e) => setFollowUpAction(e.target.value)}
                className="w-full p-2.5 text-xs rounded-lg border bg-slate-900/80 border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {FOLLOW_UP_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Detailed Rationale Textarea */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                5. Detailed Investigation Rationale & Notes {decision !== 'ACCEPTED' && <span className="text-rose-400">*</span>}
              </label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Document your full investigative reasoning, cardholder communications, and evidence justification..."
                className="w-full h-24 p-2.5 text-xs rounded-lg border bg-slate-900/80 border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsActionModalOpen(false)}
                className="px-4 py-2 text-xs rounded-lg font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActionSubmit}
                disabled={actingOn !== null}
                className="px-5 py-2 text-xs rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle className="h-4 w-4" />
                {actingOn ? 'Recording Documentation...' : 'Submit & Record Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Structured Escalation Modal */}
      {isEscalateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="triage-modal-dialog w-full max-w-lg rounded-xl border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--color-background-alt)',
              borderColor: 'rgba(239, 68, 68, 0.4)',
              color: 'var(--color-text-primary)',
            }}
          >
            <div className="flex items-center gap-2 text-rose-400 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
              <AlertTriangle className="h-5 w-5" />
              <div>
                <h3 className="text-lg font-bold">Escalate Case to Team Lead</h3>
                <p className="text-xs text-slate-400">Document suspected high-risk pattern and reasons for escalation</p>
              </div>
            </div>

            {modalError && (
              <div className="p-3 rounded text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                {modalError}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Primary Suspicion Classification</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 text-xs rounded-lg border bg-slate-900/80 border-slate-700 text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {CLASSIFICATION_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Initial Checks Completed</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VERIFICATION_METHODS_OPTIONS.map((method) => {
                  const isChecked = selectedVerificationMethods.includes(method);
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => toggleVerificationMethod(method)}
                      className={`p-2 text-left text-xs rounded-lg border transition-all flex items-center gap-2 cursor-pointer ${
                        isChecked
                          ? 'border-rose-500/50 bg-rose-950/30 text-rose-200 font-medium'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${isChecked ? 'bg-rose-600 text-white' : 'border border-slate-700 bg-slate-800'}`}>
                        {isChecked ? '✓' : ''}
                      </span>
                      <span className="truncate">{method}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Escalation Justification & Findings <span className="text-rose-400">*</span> (min 10 characters)
              </label>
              <textarea
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Detail the anomalous indicators, suspected compromise vectors, or policy exceptions requiring Team Lead override..."
                className="w-full h-28 p-2.5 text-xs rounded-lg border bg-slate-900/80 border-slate-700 text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEscalateModalOpen(false)}
                className="px-4 py-2 text-xs rounded-lg font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEscalateSubmit}
                disabled={actingOn !== null}
                className="px-5 py-2 text-xs rounded-lg font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <AlertTriangle className="h-4 w-4" />
                {actingOn ? 'Submitting Escalation...' : 'Confirm Escalation to Team Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 409 Stale Concurrency Conflict Modal */}
      {isConflictModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-xl border border-amber-500/50 p-6 shadow-2xl space-y-4 text-center"
            style={{
              backgroundColor: 'var(--color-background-alt)',
              color: 'var(--color-text-primary)',
            }}
          >
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-amber-300">Case Version Stale (HTTP 409)</h3>
            <p className="text-xs text-slate-300">
              Another reviewer or background process modified this case state while you were viewing it.
            </p>
            <div className="pt-3">
              <button
                onClick={async () => {
                  setIsConflictModalOpen(false);
                  await fetchCaseDetail();
                }}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer"
              >
                Refresh Case State
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseDetail;
