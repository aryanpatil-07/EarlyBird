/**
 * Dashboard Page
 * Operational metrics, SLA health, and trends
 * 
 * Features:
 * - 6-card metric grid (Precision, Recall, RCA%, KB%, SLA%, Dedup%)
 * - Trend chart (Chart.js line graph for cases/day)
 * - SLA health bar (color-coded: green/amber/red)
 * - Last updated timestamp
 */

import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { apiClient } from '../lib/api.ts';
import { Clock } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Metrics {
  precision: number;
  recall: number;
  rca_accuracy: number;
  kb_coverage: number;
  sla_compliance: number;
  dedup_rate: number;
  last_updated: string;
}

interface SLAHealth {
  under_1h: number;
  between_1_2h: number;
  over_2h: number;
  approaching_breach: number;
}

interface TrendData {
  dates: string[];
  created: number[];
  resolved: number[];
}

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [slaHealth, setSLAHealth] = useState<SLAHealth | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch metrics
        const metricsData = await apiClient.getDashboardMetrics();
        setMetrics(metricsData);

        // Fetch SLA health
        const slaData = await apiClient.getSLAHealth();
        setSLAHealth(slaData);

        // Fetch trend data
        const trendData = await apiClient.getCaseTrends({ days: 7 });
        setTrends(trendData);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-50">Dashboard</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-gray-600 dark:text-gray-400">Loading metrics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-50">Dashboard</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const MetricCard: React.FC<{ label: string; value: number; unit?: string }> = ({ label, value, unit = '%' }) => (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-gray-900 dark:text-gray-50">{value}</span>
        <span className="text-lg text-gray-500 dark:text-gray-500">{unit}</span>
      </div>
      <div className="mt-4 w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 dark:bg-blue-500 h-full transition-all"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );

  const chartData = trends ? {
    labels: trends.dates,
    datasets: [
      {
        label: 'Cases Created',
        data: trends.created,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#3B82F6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Cases Resolved',
        data: trends.resolved,
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10B981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  } : null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Operational metrics and SLA health</p>
        </div>
        {metrics && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Updated {new Date(metrics.last_updated).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics && (
          <>
            <MetricCard label="Precision" value={Math.round(metrics.precision * 100)} />
            <MetricCard label="Recall" value={Math.round(metrics.recall * 100)} />
            <MetricCard label="RCA Accuracy" value={Math.round(metrics.rca_accuracy * 100)} />
            <MetricCard label="KB Coverage" value={Math.round(metrics.kb_coverage * 100)} />
            <MetricCard label="SLA Compliance" value={Math.round(metrics.sla_compliance * 100)} />
            <MetricCard label="Dedup Rate" value={Math.round(metrics.dedup_rate * 100)} />
          </>
        )}
      </div>

      {/* Trend Chart */}
      {chartData && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
            Case Trends (7 Days)
          </h2>
          <div style={{ height: '300px', position: 'relative' }}>
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: 'top',
                    labels: {
                      usePointStyle: true,
                      padding: 15,
                      font: { size: 13, weight: 'bold' },
                      color: document.documentElement.classList.contains('dark')
                        ? '#D1D5DB'
                        : '#374151',
                    },
                  },
                  tooltip: {
                    backgroundColor: document.documentElement.classList.contains('dark')
                      ? 'rgba(15, 23, 42, 0.9)'
                      : 'rgba(255, 255, 255, 0.9)',
                    titleColor: document.documentElement.classList.contains('dark')
                      ? '#F1F5F9'
                      : '#1F2937',
                    bodyColor: document.documentElement.classList.contains('dark')
                      ? '#D1D5DB'
                      : '#4B5563',
                    borderColor: document.documentElement.classList.contains('dark')
                      ? '#334155'
                      : '#E5E7EB',
                    borderWidth: 1,
                    padding: 8,
                    cornerRadius: 6,
                  },
                },
                scales: {
                  x: {
                    grid: {
                      display: true,
                      color: document.documentElement.classList.contains('dark')
                        ? 'rgba(51, 65, 85, 0.3)'
                        : 'rgba(229, 231, 235, 0.5)',
                    },
                    ticks: {
                      color: document.documentElement.classList.contains('dark')
                        ? '#9CA3AF'
                        : '#6B7280',
                      font: { size: 12 },
                    },
                  },
                  y: {
                    grid: {
                      display: true,
                      color: document.documentElement.classList.contains('dark')
                        ? 'rgba(51, 65, 85, 0.3)'
                        : 'rgba(229, 231, 235, 0.5)',
                    },
                    ticks: {
                      color: document.documentElement.classList.contains('dark')
                        ? '#9CA3AF'
                        : '#6B7280',
                      font: { size: 12 },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* SLA Health */}
      {slaHealth && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">SLA Health</h2>

          <div className="space-y-4">
            {/* Health Breakdown */}
            <div className="grid grid-cols-3 gap-4">
              {/* Under 1h */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {'< 1 hour'}
                  </span>
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {slaHealth.under_1h}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${slaHealth.under_1h}%` }}
                  />
                </div>
              </div>

              {/* 1-2h */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    1–2 hours
                  </span>
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {slaHealth.between_1_2h}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${slaHealth.between_1_2h}%` }}
                  />
                </div>
              </div>

              {/* Over 2h */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {'> 2 hours'}
                  </span>
                  <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                    {slaHealth.over_2h}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-red-500 h-full rounded-full"
                    style={{ width: `${slaHealth.over_2h}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Warning Banner */}
            {slaHealth.approaching_breach > 0 && (
              <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="text-sm font-medium text-amber-900 dark:text-amber-300">
                  ⚠️ {slaHealth.approaching_breach} case{slaHealth.approaching_breach !== 1 ? 's' : ''} approaching SLA breach
                </div>
                <div className="text-xs text-amber-800 dark:text-amber-400 mt-1">
                  These cases are in the 1–2 hour window and may escalate if not resolved
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
