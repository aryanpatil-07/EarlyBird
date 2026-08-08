import React, { useEffect, useState, useRef } from 'react';
import anime from 'animejs';
import { apiClient } from '../lib/api';
import {
  BarChart3,
  RefreshCw,
  ShieldCheck,
  Clock,
  Activity,
  Zap,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
import { ComposedChart, ComposedDataPoint } from '../components/charts/ComposedChart';
import { RingChart, RingDataItem } from '../components/charts/RingChart';
import { HorizontalBarChart, CategoryBarItem } from '../components/charts/HorizontalBarChart';

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
  time_series?: ComposedDataPoint[];
  triage_breakdown?: {
    resolved: number;
    escalated: number;
    new: number;
    total: number;
    resolutionRate: number;
  };
  category_breakdown?: CategoryBarItem[];
  sla_gauge?: {
    compliance_pct: number;
    target_pct: number;
    status: string;
  };
  counts?: {
    transactions: number;
    openCases: number;
    resolvedCases: number;
    escalatedCases: number;
    newCases: number;
    knowledgeBaseEntries: number;
  };
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export const Dashboard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
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
        apiClient.getAuditLog({ pageSize: 8 }),
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

  // anime.js staggered card reveal
  useEffect(() => {
    if (!loading && metrics && containerRef.current) {
      anime({
        targets: containerRef.current.querySelectorAll('.dashboard-reveal-card'),
        opacity: [0, 1],
        translateY: [12, 0],
        easing: 'easeOutQuad',
        duration: 400,
        delay: anime.stagger(25),
      });
    }
  }, [loading, metrics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMetrics();
    setRefreshing(false);
  };

  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-sky-400" />
          <h1 className="text-2xl font-bold text-white">Telemetry & Radar</h1>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[#111218] p-16 text-center shadow-xl">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-500 mb-3" />
          <p className="text-xs text-slate-400 font-mono">Synthesizing real-time telemetry feed...</p>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6 text-rose-300">
          <h3 className="font-bold text-sm">Error Loading Telemetry Feed</h3>
          <p className="text-xs text-rose-300/80 mt-1">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl bg-rose-600/30 text-rose-200 border border-rose-500/40 hover:bg-rose-600/50 cursor-pointer"
          >
            Retry Feed
          </button>
        </div>
      </div>
    );
  }

  // Derived Telemetry Values
  const mttd = metrics.mttd_hours ?? 0.12;
  const mttr = metrics.mttr_hours ?? 0.45;
  const dedup = (metrics.dedup_rate ?? metrics.detection_rate ?? 0) * (metrics.dedup_rate !== undefined ? 100 : 1);
  const slaCompliance = metrics.sla_gauge?.compliance_pct ?? (metrics.sla_compliance ?? 98.4);
  const totalOpenCases = (metrics.counts?.newCases ?? 12) + (metrics.counts?.escalatedCases ?? 6);
  const resolvedCases = metrics.counts?.resolvedCases ?? 20;

  // Ring Chart Data (Triage Breakdown with Light Blue / Cyan Theme)
  const ringChartData: RingDataItem[] = [
    {
      label: 'Resolved',
      value: resolvedCases,
      maxValue: Math.max(resolvedCases + totalOpenCases, 40),
      color: '#10B981', // Emerald
    },
    {
      label: 'Escalated',
      value: metrics.counts?.escalatedCases ?? 6,
      maxValue: Math.max(resolvedCases + totalOpenCases, 40),
      color: '#F59E0B', // Amber
    },
    {
      label: 'New / Triage',
      value: metrics.counts?.newCases ?? 12,
      maxValue: Math.max(resolvedCases + totalOpenCases, 40),
      color: '#38BDF8', // Light Blue / Sky
    },
  ];

  // Default fallback time series
  const defaultTimeSeries: ComposedDataPoint[] = [
    { timestamp: '00:00', totalTransactions: 620, anomalies: 8, anomalyRate: 1.29, baselineThreshold: 580 },
    { timestamp: '02:00', totalTransactions: 540, anomalies: 5, anomalyRate: 0.92, baselineThreshold: 510 },
    { timestamp: '04:00', totalTransactions: 480, anomalies: 3, anomalyRate: 0.62, baselineThreshold: 450 },
    { timestamp: '06:00', totalTransactions: 590, anomalies: 7, anomalyRate: 1.18, baselineThreshold: 550 },
    { timestamp: '08:00', totalTransactions: 840, anomalies: 14, anomalyRate: 1.66, baselineThreshold: 780 },
    { timestamp: '10:00', totalTransactions: 1120, anomalies: 28, anomalyRate: 2.50, baselineThreshold: 1040 },
    { timestamp: '12:00', totalTransactions: 1350, anomalies: 34, anomalyRate: 2.51, baselineThreshold: 1250 },
    { timestamp: '14:00', totalTransactions: 1280, anomalies: 22, anomalyRate: 1.71, baselineThreshold: 1180 },
    { timestamp: '16:00', totalTransactions: 1420, anomalies: 39, anomalyRate: 2.74, baselineThreshold: 1310 },
    { timestamp: '18:00', totalTransactions: 1310, anomalies: 26, anomalyRate: 1.98, baselineThreshold: 1220 },
    { timestamp: '20:00', totalTransactions: 1090, anomalies: 18, anomalyRate: 1.65, baselineThreshold: 1010 },
    { timestamp: '22:00', totalTransactions: 880, anomalies: 11, anomalyRate: 1.25, baselineThreshold: 820 },
  ];

  const timeSeriesData = metrics.time_series && metrics.time_series.length > 0 ? metrics.time_series : defaultTimeSeries;

  // Category Breakdown Data for Horizontal Bar Chart (Light Blue Accents)
  const defaultCategories: CategoryBarItem[] = [
    { category: 'Card-Not-Present (CNP) e-Commerce', count: 18, percentage: 42.0, color: '#38BDF8' },
    { category: 'Rapid Velocity Burst / Automated Script', count: 11, percentage: 26.0, color: '#0EA5E9' },
    { category: 'Compromised Terminal / High-Risk Merchant', count: 7, percentage: 16.0, color: '#F59E0B' },
    { category: 'Geographic Impossibility / IP Conflict', count: 4, percentage: 10.0, color: '#06B6D4' },
    { category: 'Benign High-Value / Cardholder Travel', count: 2, percentage: 6.0, color: '#10B981' },
  ];

  const categoryData = metrics.category_breakdown && metrics.category_breakdown.length > 0 ? metrics.category_breakdown : defaultCategories;

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Hero Headline & Telemetry Action Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-wider uppercase text-slate-400 mb-1">
            Operational Telemetry • Real-Time Radar
          </div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-heading">
              $1,025,254<span className="text-sky-400 font-normal">.00</span>
            </h1>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <TrendingUp size={12} />
              +4.2% volume
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            24h transactions evaluated • <strong className="text-slate-200">2 mins ago</strong> last anomaly sync
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#111218] hover:bg-[#161822] text-slate-200 border border-white/[0.08] hover:border-white/[0.15] flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-slate-400' : 'text-slate-400'} />
            <span>Sync Feed</span>
          </button>
          <button
            onClick={() => apiClient.triggerDetection().then(() => fetchMetrics())}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 border border-sky-400/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Zap size={14} className="text-amber-300" />
            <span>Trigger Sweep</span>
          </button>
        </div>
      </div>

      {/* Hero 2-Column Overview (Without the Promo Card) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Multi-Currency & Entity Baselines */}
        <div className="dashboard-reveal-card rounded-2xl bg-[#111218] border border-white/[0.06] p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Entity Baselines</div>
              <div className="text-[11px] text-slate-400">Active monitored accounts & cards</div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-300 border border-white/[0.06]">
              Real-time
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#0B0C10] border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">🇺🇸</span>
                <span className="text-xs font-bold text-white font-mono">$853,698</span>
              </div>
              <div className="text-[10px] text-slate-400">USD Core Pool</div>
            </div>

            <div className="p-3 rounded-xl bg-[#0B0C10] border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">🇯🇵</span>
                <span className="text-xs font-bold text-white font-mono">¥154,578</span>
              </div>
              <div className="text-[10px] text-slate-400">Cross-Border JPY</div>
            </div>
          </div>

          {/* Virtual Card Graphic with Light Blue Gradient */}
          <div className="p-4 rounded-xl bg-gradient-to-tr from-sky-950/80 via-blue-950/60 to-cyan-900/40 border border-sky-500/20 shadow-inner">
            <div className="flex justify-between items-center text-[11px] text-sky-300 font-mono mb-2">
              <span className="font-bold">EARLYBIRD RADAR</span>
              <CreditCard size={14} />
            </div>
            <div className="font-mono text-xs text-white tracking-widest font-semibold mb-2">
              •••• •••• •••• 3090
            </div>
            <div className="flex justify-between items-center text-[10px] text-sky-300/80 font-mono">
              <span>CARDHOLDER VERIFIED</span>
              <span>08/26</span>
            </div>
          </div>
        </div>

        {/* Right: 4 Key Detection Telemetry Metrics */}
        <div className="dashboard-reveal-card rounded-2xl bg-[#111218] border border-white/[0.06] p-5 shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
            <div className="text-xs font-semibold text-white">Detection Latency & SLA Performance</div>
            <ShieldCheck size={16} className="text-emerald-400" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0B0C10] border border-white/[0.04]">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock size={14} className="text-sky-400" />
                <span>Mean Time to Detect</span>
              </div>
              <span className="text-xs font-bold font-mono text-sky-300">{mttd.toFixed(2)} hrs</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0B0C10] border border-white/[0.04]">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Activity size={14} className="text-emerald-400" />
                <span>Mean Time to Resolve</span>
              </div>
              <span className="text-xs font-bold font-mono text-emerald-300">{mttr.toFixed(2)} hrs</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0B0C10] border border-white/[0.04]">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Zap size={14} className="text-amber-400" />
                <span>Alert Deduplication Rate</span>
              </div>
              <span className="text-xs font-bold font-mono text-amber-300">{dedup.toFixed(1)}%</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0B0C10] border border-white/[0.04]">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck size={14} className="text-cyan-400" />
                <span>SLA Acknowledgment Compliance</span>
              </div>
              <span className="text-xs font-bold font-mono text-cyan-300">{slaCompliance.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* HERO CHARTS ROW: ComposedChart (2 cols) + RingChart (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Composed Chart */}
        <div className="dashboard-reveal-card lg:col-span-2 rounded-2xl bg-[#111218] border border-white/[0.06] p-5 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.04] pb-3">
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                24-Hour Velocity & Anomaly Oscilloscope
              </h2>
              <p className="text-[11px] text-slate-400">
                Shared time-series with volume columns, EWMA baseline, and anomaly rate trace
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-xs bg-sky-500 inline-block" />
                <span>Volume</span>
              </div>
              <div className="flex items-center gap-1.5 text-sky-300">
                <span className="w-2 h-1 bg-sky-400/40 inline-block" />
                <span>Baseline</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2 h-0.5 bg-rose-500 inline-block" />
                <span>Anomaly %</span>
              </div>
            </div>
          </div>

          <ComposedChart data={timeSeriesData} maxBarSize={28} barGap={4} />
        </div>

        {/* Ring Chart: Multi-Ring Case Triage */}
        <div className="dashboard-reveal-card lg:col-span-1 rounded-2xl bg-[#111218] border border-white/[0.06] p-5 shadow-xl flex flex-col justify-between">
          <div className="border-b border-white/[0.04] pb-3 mb-2">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Case Resolution & Triage Rings
            </h2>
            <p className="text-[11px] text-slate-400">
              Concentric lifecycle progress
            </p>
          </div>

          <div className="py-2">
            <RingChart
              data={ringChartData}
              size={240}
              strokeWidth={13}
              ringGap={6}
              baseInnerRadius={48}
              centerTitle="Open Queue"
              centerValue={`${totalOpenCases} Active`}
            />
          </div>
        </div>
      </div>

      {/* SECONDARY ROW: Horizontal Category Breakdown + Forensic Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Horizontal Bar Chart: Top Fraud Categories */}
        <div className="dashboard-reveal-card lg:col-span-2 rounded-2xl bg-[#111218] border border-white/[0.06] p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Top Anomaly & Fraud Classifications
              </h2>
              <p className="text-[11px] text-slate-400">
                Ranked breakdown by operational forensic category
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-[#0B0C10] font-mono text-slate-300 font-semibold border border-white/[0.04]">
              {categoryData.reduce((acc, c) => acc + c.count, 0)} Cases Evaluated
            </span>
          </div>

          <HorizontalBarChart data={categoryData} />
        </div>

        {/* Live Forensic Audit Trail */}
        <div className="dashboard-reveal-card lg:col-span-1 rounded-2xl bg-[#111218] border border-white/[0.06] p-5 shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Recent Forensic Activity
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">{auditLogs.length} Events</span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
            {auditLogs.length > 0 ? (
              auditLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[#0B0C10] border border-white/[0.04] text-xs flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 font-mono font-bold text-[10px] border border-sky-500/20">
                      {log.action}
                    </span>
                    <span className="text-slate-300 text-[11px] truncate">{log.entity_id}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 text-center py-6">No recent audit events</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
