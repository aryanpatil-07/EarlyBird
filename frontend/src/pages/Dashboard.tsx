/**
 * Dashboard Page — Metrics & Analytics
 * High-density fintech console aesthetic
 * 
 * Five metric cards:
 * 1. Cases Processed — total reviewed/resolved in last 24h
 * 2. Detection Rate — % of transactions flagged anomalous
 * 3. SLA Compliance — % of cases resolved within SLA window
 * 4. False Positive Rate — % of RESOLVED cases marked FALSE_POSITIVE
 * 5. Team Workload — current NEW/ACCEPTED cases in queue
 * 
 * Each card: metric value (indigo-600, large), label, trend sparkline, threshold badge (green/yellow/red + text)
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../components/ui/index';
import { apiClient } from '../lib/api';
import { TrendingUp, TrendingDown, AlertCircle, BarChart3 } from 'lucide-react';

interface DashboardMetrics {
  mttd_hours?: number;
  mttr_hours?: number;
  dedup_rate?: number;
  sla_ack_compliance?: number;
  kb_coverage?: number;
  precision?: number;
  recall?: number;
  cases_processed_24h?: number;
  detection_rate?: number;
  sla_compliance?: number;
  false_positive_rate?: number;
  current_workload?: number;
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  threshold?: 'good' | 'warning' | 'critical';
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit = '',
  threshold = 'good',
}) => {
  const thresholdColors = {
    good: 'border border-green-500/30 bg-green-500/10 text-green-400',
    warning: 'border border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
    critical: 'border border-red-500/30 bg-red-500/10 text-red-400',
  };

  const thresholdLabels = {
    good: '✓ On Target',
    warning: '⚠ Watch',
    critical: '✗ Alert',
  };

  return (
    <Card className="border shadow-lg backdrop-blur-md" style={{
      backgroundColor: 'var(--color-background-alt)',
      borderColor: 'var(--color-border)',
    }}>
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</h3>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${thresholdColors[threshold]}`}>
              {thresholdLabels[threshold]}
            </span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--color-primary)' }}>{value}</span>
            {unit && <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{unit}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsData, auditData] = await Promise.all([
        apiClient.getDashboardMetrics(),
        apiClient.getAuditLog({ pageSize: 10 }),
      ]);

      setMetrics(metricsData);
      setAuditLogs(auditData.items || auditData.entries || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMetrics();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-foreground)' }}>Dashboard</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin border-4 rounded-full h-8 w-8 border-t-indigo-500 border-slate-700" />
          <span className="ml-3 text-sm text-slate-400">Loading metrics & audit feed...</span>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-foreground)' }}>Dashboard</h1>
        </div>
        <Card className="border border-red-500/30 bg-red-500/10">
          <CardContent className="p-6 flex items-start gap-4">
            <AlertCircle className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-400">Error Loading Dashboard</h3>
              <p className="text-sm text-red-400/80 mt-1">{error}</p>
              <button onClick={handleRefresh} className="mt-3 text-xs font-medium text-red-400 underline">
                Try again
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mttd = metrics.mttd_hours ?? 0;
  const mttr = metrics.mttr_hours ?? 0;
  const dedup = (metrics.dedup_rate ?? metrics.detection_rate ?? 0) * (metrics.dedup_rate !== undefined ? 100 : 1);
  const slaAck = (metrics.sla_ack_compliance ?? metrics.sla_compliance ?? 0) * (metrics.sla_ack_compliance !== undefined ? 100 : 1);
  const kbCov = (metrics.kb_coverage ?? 0) * 100;
  const precision = (metrics.precision ?? 0) * 100;
  const recall = (metrics.recall ?? 0) * 100;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-foreground)' }}>Dashboard</h1>
          </div>
          <p className="text-xs text-slate-400">Real-time fraud detection & triage metrics</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border bg-slate-800 border-slate-700 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <span className={refreshing ? 'animate-spin' : ''}>↻</span>
          Refresh
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Mean Time to Detect (MTTD)" value={mttd.toFixed(2)} unit="hrs" threshold="good" />
        <MetricCard label="Mean Time to Resolve (MTTR)" value={mttr.toFixed(2)} unit="hrs" threshold="good" />
        <MetricCard label="De-duplication Rate" value={`${dedup.toFixed(1)}%`} threshold={dedup >= 30 ? 'good' : 'warning'} />
        <MetricCard label="SLA Acknowledgement" value={`${slaAck.toFixed(1)}%`} threshold={slaAck >= 90 ? 'good' : 'critical'} />
        <MetricCard label="Documentation Coverage" value={`${kbCov.toFixed(1)}%`} threshold={kbCov >= 80 ? 'good' : 'warning'} />
      </div>

      {/* Model Accuracy Baseline Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-indigo-500/30 bg-indigo-950/20 backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">Model Precision</div>
              <div className="text-2xl font-bold text-indigo-200 mt-1">{precision.toFixed(1)}%</div>
            </div>
            <div className="text-xs text-slate-400">Target: ≥80%</div>
          </div>
        </Card>
        <Card className="border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">Model Recall</div>
              <div className="text-2xl font-bold text-emerald-200 mt-1">{recall.toFixed(1)}%</div>
            </div>
            <div className="text-xs text-slate-400">Target: ≥80%</div>
          </div>
        </Card>
      </div>

      {/* Live Audit Feed */}
      <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider text-slate-300">
            Live Forensic Audit Trail
          </h2>
          {auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/40 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-semibold">
                      [{log.action}]
                    </span>
                    <span className="text-slate-200 font-medium">{log.entity_type} {log.entity_id}</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>{log.actor}</span>
                    <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">No recent audit log activity</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
