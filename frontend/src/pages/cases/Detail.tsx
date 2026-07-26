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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/cases')}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
              Case {data.id}
            </h1>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <StateBadge state={data.state} />
            <Badge
              style={{ backgroundColor: SEVERITY_COLORS[data.severity] }}
              className="text-gray-900"
            >
              {data.severity}
            </Badge>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Created: {formatDate(data.created_at)}
            </div>
            <SLABadge createdAt={data.created_at} />
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
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
              className="bg-amber-500 hover:bg-amber-600"
            >
              {actingOn === 'accept' ? 'Accepting...' : 'Accept'}
            </Button>
          )}
          {isAccepted && (
            <Button
              onClick={handleResolve}
              disabled={actingOn !== null}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {actingOn === 'resolve' ? 'Resolving...' : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Resolve
                </>
              )}
            </Button>
          )}
          {!isEscalated && (
            <Button
              onClick={handleEscalate}
              disabled={actingOn !== null}
              variant="destructive"
            >
              {actingOn === 'escalate' ? 'Escalating...' : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Escalate
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* KB Link */}
      {isResolved && data.knowledge_base_entry && (
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Knowledge Base Entry
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {data.knowledge_base_entry.title}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/knowledge-base/${data.knowledge_base_entry!.id}`)}
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                View Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Anomaly Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Entity
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                    {data.entity_id}
                  </div>
                  <button
                    className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(data.entity_id);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Anomaly Amount
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                    {formatCurrency(anomalyAmount)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Deviation: {data.anomaly_score.toFixed(2)}σ
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Baseline Mean
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                    {formatCurrency(data.baseline_mean)}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Baseline StdDev
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                    {formatCurrency(data.baseline_stddev)}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Related Anomalies
                </div>
                {data.related_anomalies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.related_anomalies.map((anomalyId) => (
                      <Badge key={anomalyId} variant="outline">
                        {anomalyId}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No related anomalies
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Root Cause Links</CardTitle>
            </CardHeader>
            <CardContent>
              {data.evidence.root_causes.length > 0 ? (
                <div className="space-y-3">
                  {data.evidence.root_causes.map((link, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {link.link_type}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {link.transaction_id}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Entity</div>
                          <div className="font-medium text-gray-900 dark:text-gray-50">
                            {link.transaction.entity_id}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Amount</div>
                          <div className="font-medium text-gray-900 dark:text-gray-50">
                            {formatCurrency(link.transaction.amount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Timestamp</div>
                          <div className="font-medium text-gray-900 dark:text-gray-50 text-xs">
                            {formatDate(link.transaction.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No root cause links found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Matching Playbook Rules</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {data.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                            {rec.recommendation_text}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Rule ID: {rec.rule_id}
                          </div>
                        </div>
                      </div>
                      {rec.condition && (
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono text-gray-700 dark:text-gray-300 mt-2">
                          {JSON.stringify(rec.condition, null, 2).substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No recommendations found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Audit Trail (Append-Only)</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLog.length > 0 ? (
                <div className="space-y-3">
                  {auditLog.map((entry, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-start gap-4"
                    >
                      <div className="flex-shrink-0 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 mt-2" />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-50">
                              [{entry.action}]
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              by {entry.actor}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {formatDate(entry.created_at)}
                          </div>
                        </div>
                        {entry.changes && (
                          <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono text-gray-700 dark:text-gray-300 mt-2">
                            {JSON.stringify(entry.changes, null, 2).substring(0, 150)}...
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No audit log entries
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
