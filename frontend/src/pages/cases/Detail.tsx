/**
 * Case Detail Page
 * Full investigation view — anomalies, root causes, recommendations, audit trail
 * 
 * Tabs:
 * 1. Overview — entity, amount, merchant, baseline deviation
 * 2. Evidence — linked transactions and root causes
 * 3. Recommendations — matching playbook rules
 * 4. Audit Trail — append-only log of actions
 * 
 * Actions: Accept, Resolve, Escalate (with state transitions)
 * SLA countdown, KB link (if resolved)
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../components/ui/index';
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
  // Note: user is from context, can be used for future permission checks
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

  // Early validation after all hooks
  if (!caseId) {
    return <div className="p-6 text-red-600">Invalid case ID</div>;
  }

  const handleAccept = async () => {
    if (!data) return;
    setActingOn('accept');
    try {
      await apiClient.acceptCase(caseId);
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
      await apiClient.resolveCase(caseId);
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
      await apiClient.escalateCase(caseId);
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
        <div className="text-gray-600 dark:text-gray-400">Loading case detail...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-red-600 dark:text-red-400">{error || 'Case not found'}</div>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => navigate('/cases')}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/cases')}
              className="h-8 w-8 text-slate-300 hover:bg-slate-700/50"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-semibold text-slate-100">
              Case {data.id.slice(0, 12)}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <StateBadge state={data.state} />
            <Badge
              style={{ backgroundColor: SEVERITY_COLORS[data.severity] }}
              className="text-slate-900 text-xs"
            >
              {data.severity}
            </Badge>
            <SLABadge createdAt={data.created_at} />
            <div className="text-xs text-slate-400">
              {formatDate(data.created_at)}
            </div>
            <div className={`text-xs font-semibold ${slaRemaining > 3600000 ? 'text-slate-400' : 'text-rose-400'}`}>
              {formatSLA(slaRemaining)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isNew && (
            <Button
              onClick={handleAccept}
              disabled={actingOn !== null}
              className="h-8 px-3 text-xs bg-indigo-600/70 hover:bg-indigo-600 text-white"
            >
              {actingOn === 'accept' ? 'Accepting...' : 'Accept'}
            </Button>
          )}
          {isAccepted && (
            <Button
              onClick={handleResolve}
              disabled={actingOn !== null}
              className="h-8 px-3 text-xs bg-green-600/70 hover:bg-green-600 text-white"
            >
              {actingOn === 'resolve' ? 'Resolving...' : (
                <>
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Resolve
                </>
              )}
            </Button>
          )}
          {!isEscalated && (
            <Button
              onClick={handleEscalate}
              disabled={actingOn !== null}
              className="h-8 px-3 text-xs bg-rose-600/50 hover:bg-rose-600/70 text-white"
            >
              {actingOn === 'escalate' ? 'Escalating...' : (
                <>
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Escalate
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* KB Link */}
      {isResolved && data.knowledge_base_entry && (
        <Card className="border-l-4 border-l-green-600/50 bg-green-950/20 border-slate-700/40">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-green-300 uppercase tracking-wide">
                  Knowledge Base
                </div>
                <div className="text-sm text-slate-300 mt-1">
                  {data.knowledge_base_entry.title}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/knowledge-base/${data.knowledge_base_entry!.id}`)}
                className="h-7 px-2 text-xs bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border-slate-600"
              >
                <LinkIcon className="mr-1 h-3 w-3" />
                View
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900/40 border-b border-slate-700/40 rounded-none">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="evidence" className="text-xs">Evidence</TabsTrigger>
          <TabsTrigger value="recommendations" className="text-xs">Recommendations</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs">Audit</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-3">
          <Card className="bg-slate-800/30 border-slate-700/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-100">Anomaly Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/40">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Entity
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mt-1">
                    {data.entity_id}
                  </div>
                  <button
                    className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(data.entity_id);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>

                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/40">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Amount
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mt-1">
                    {formatCurrency(anomalyAmount)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {data.anomaly_score.toFixed(2)}σ
                  </div>
                </div>

                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/40">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Baseline Mean
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mt-1">
                    {formatCurrency(data.baseline_mean)}
                  </div>
                </div>

                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/40">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Baseline σ
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mt-1">
                    {formatCurrency(data.baseline_stddev)}
                  </div>
                </div>
              </div>

              {data.related_anomalies.length > 0 && (
                <div className="border-t border-slate-700/40 pt-3">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Related Anomalies
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.related_anomalies.map((anomalyId) => (
                      <Badge key={anomalyId} variant="outline" className="text-xs bg-slate-900/40 border-slate-700/40 text-slate-300">
                        {anomalyId.slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence" className="space-y-3">
          <Card className="bg-slate-800/30 border-slate-700/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-100">Root Cause Links</CardTitle>
            </CardHeader>
            <CardContent>
              {data.evidence.root_causes.length > 0 ? (
                <div className="space-y-2">
                  {data.evidence.root_causes.map((link, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-700/40 rounded-lg p-3 bg-slate-900/20"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-xs font-semibold text-slate-200">
                          {link.link_type}
                        </div>
                        <Badge variant="outline" className="text-xs bg-slate-900/40 border-slate-700/40 text-slate-400">
                          {link.transaction_id.slice(0, 8)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <div className="text-slate-500">Entity</div>
                          <div className="font-medium text-slate-200 mt-0.5">
                            {link.transaction.entity_id}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Amount</div>
                          <div className="font-medium text-slate-200 mt-0.5">
                            {formatCurrency(link.transaction.amount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Time</div>
                          <div className="font-medium text-slate-200 mt-0.5">
                            {formatDate(link.transaction.timestamp).slice(0, 16)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No root cause links
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-3">
          <Card className="bg-slate-800/30 border-slate-700/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-100">Matching Rules</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recommendations.length > 0 ? (
                <div className="space-y-2">
                  {data.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-700/40 rounded-lg p-3 bg-slate-900/20"
                    >
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-slate-200">
                            {rec.recommendation_text}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {rec.rule_id}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No recommendations
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-3">
          <Card className="bg-slate-800/30 border-slate-700/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-100">Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLog.length > 0 ? (
                <div className="space-y-2">
                  {auditLog.map((entry, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-700/40 rounded-lg p-3 bg-slate-900/20 flex items-start gap-3"
                    >
                      <div className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-indigo-500/70 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-slate-200">
                              [{entry.action}]
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {entry.actor}
                            </div>
                          </div>
                          <div className="text-xs text-slate-600 whitespace-nowrap">
                            {formatDate(entry.created_at).slice(0, 16)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No audit entries
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CaseDetail;
