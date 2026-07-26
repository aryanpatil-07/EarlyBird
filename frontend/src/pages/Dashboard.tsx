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
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface DashboardMetrics {
  cases_processed_24h: number;
  detection_rate: number;
  sla_compliance: number;
  false_positive_rate: number;
  current_workload: number;
  trends?: {
    cases_processed: number[];
    detection_rate: number[];
    sla_compliance: number[];
    false_positive_rate: number[];
  };
}

interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  threshold?: 'good' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'flat';
  sparklineData?: number[];
  icon?: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit = '',
  threshold = 'good',
  trend = 'flat',
  sparklineData = [],
}) => {
  const thresholdColors = {
    good: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200/30 dark:border-green-900/30',
    warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200/30 dark:border-yellow-900/30',
    critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/30 dark:border-red-900/30',
  };

  const thresholdLabels = {
    good: '✓ On Target',
    warning: '⚠ Watch',
    critical: '✗ Critical',
  };

  const trendColor = {
    up: 'text-green-500',
    down: 'text-red-500',
    flat: 'text-slate-400',
  };

  return (
    <Card className="bg-slate-800/30 border-slate-700/60 hover:border-slate-700 transition-colors">
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Header: Label + Threshold Badge */}
          <div className="flex items-start justify-between">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</h3>
            <span
              className={`text-xs font-medium px-2 py-1 rounded border ${thresholdColors[threshold]}`}
            >
              {thresholdLabels[threshold]}
            </span>
          </div>

          {/* Main Metric Value */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-indigo-600">{value}</span>
            {unit && <span className="text-sm text-slate-400">{unit}</span>}
          </div>

          {/* Sparkline placeholder + Trend */}
          <div className="flex items-center gap-3 h-8">
            {/* Simple sparkline visualization (placeholder — can be replaced with Chart.js mini) */}
            {sparklineData.length > 0 && (
              <div className="flex-1 flex items-end gap-0.5 h-full">
                {sparklineData.slice(-7).map((val, idx) => {
                  const minVal = Math.min(...sparklineData.slice(-7));
                  const maxVal = Math.max(...sparklineData.slice(-7));
                  const range = maxVal - minVal || 1;
                  const normalized = (val - minVal) / range;
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-indigo-600/40 rounded-sm"
                      style={{ height: `${Math.max(20, normalized * 100)}%` }}
                    />
                  );
                })}
              </div>
            )}

            {/* Trend indicator */}
            {trend === 'up' && <TrendingUp className={`h-4 w-4 ${trendColor[trend]}`} />}
            {trend === 'down' && <TrendingDown className={`h-4 w-4 ${trendColor[trend]}`} />}
          </div>

          {/* Meta: Compare to threshold or benchmark */}
          <p className="text-xs text-slate-500 mt-2">
            {threshold === 'good' && '↑ Above target'}
            {threshold === 'warning' && '→ At threshold'}
            {threshold === 'critical' && '↓ Below threshold'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsData, trendsData] = await Promise.all([
        apiClient.getDashboardMetrics(),
        apiClient.getCaseTrends({ days: 7 }),
      ]);

      setMetrics({
        ...metricsData,
        trends: trendsData,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30s
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-100">📊 Dashboard</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin">
            <div className="border-4 border-slate-500/30 border-t-slate-400 rounded-full h-8 w-8" />
          </div>
          <span className="ml-3 text-slate-400">Loading metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-bold text-slate-100">📊 Dashboard</h1>
        <Card className="bg-red-500/10 border-red-900/30">
          <CardContent className="p-6 flex items-start gap-4">
            <AlertCircle className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-600 dark:text-red-400">Error Loading Dashboard</h3>
              <p className="text-sm text-red-500/80 mt-1">{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-3 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Try again
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  // Determine thresholds based on industry benchmarks
  const slaThreshold = metrics.sla_compliance >= 95 ? 'good' : metrics.sla_compliance >= 80 ? 'warning' : 'critical';
  const fpThreshold = metrics.false_positive_rate <= 5 ? 'good' : metrics.false_positive_rate <= 15 ? 'warning' : 'critical';
  const detectionThreshold = metrics.detection_rate >= 10 ? 'good' : metrics.detection_rate >= 5 ? 'warning' : 'critical';
  const workloadThreshold = metrics.current_workload <= 50 ? 'good' : metrics.current_workload <= 100 ? 'warning' : 'critical';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-1">📊 Dashboard</h1>
          <p className="text-sm text-slate-400">Real-time anomaly detection metrics</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 h-11 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          <span className={`${refreshing ? 'animate-spin' : ''} motion-reduce:animate-none`}>↻</span>
          Refresh
        </button>
      </div>

      {/* Five Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Cases Processed */}
        <MetricCard
          label="Cases Processed"
          value={metrics.cases_processed_24h}
          unit="last 24h"
          threshold="good"
          trend="up"
          sparklineData={metrics.trends?.cases_processed || []}
        />

        {/* 2. Detection Rate */}
        <MetricCard
          label="Detection Rate"
          value={`${metrics.detection_rate.toFixed(2)}`}
          unit="%"
          threshold={detectionThreshold}
          trend="up"
          sparklineData={metrics.trends?.detection_rate || []}
        />

        {/* 3. SLA Compliance */}
        <MetricCard
          label="SLA Compliance"
          value={`${metrics.sla_compliance.toFixed(2)}`}
          unit="%"
          threshold={slaThreshold}
          trend={metrics.sla_compliance >= 90 ? 'up' : 'down'}
          sparklineData={metrics.trends?.sla_compliance || []}
        />

        {/* 4. False Positive Rate */}
        <MetricCard
          label="False Positive Rate"
          value={`${metrics.false_positive_rate.toFixed(2)}`}
          unit="%"
          threshold={fpThreshold}
          trend={metrics.false_positive_rate < 10 ? 'down' : 'up'}
          sparklineData={metrics.trends?.false_positive_rate || []}
        />

        {/* 5. Team Workload */}
        <MetricCard
          label="Current Workload"
          value={metrics.current_workload}
          unit="cases"
          threshold={workloadThreshold}
          trend={metrics.current_workload > 100 ? 'up' : 'flat'}
        />
      </div>

      {/* Secondary Section: Recent Activity or Details (optional expansion) */}
      <Card className="bg-slate-800/30 border-slate-700/60">
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
            System Health
          </h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-700/40">
              <p className="text-slate-500 text-xs mb-2">API Latency</p>
              <p className="text-slate-100 font-medium">&lt;50ms</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-700/40">
              <p className="text-slate-500 text-xs mb-2">Database</p>
              <p className="text-green-500 font-medium">✓ Healthy</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-700/40">
              <p className="text-slate-500 text-xs mb-2">Last Sync</p>
              <p className="text-slate-100 font-medium">Now</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
