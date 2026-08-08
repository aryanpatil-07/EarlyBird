import React, { useState, useEffect, useRef } from 'react';
import anime from 'animejs';

export interface ComposedDataPoint {
  timestamp: string;
  totalTransactions: number;
  anomalies: number;
  anomalyRate: number;
  baselineThreshold: number;
  [key: string]: any;
}

export interface ComposedChartProps {
  data: ComposedDataPoint[];
  aspectRatio?: string;
  maxBarSize?: number;
  barGap?: number;
  xDataKey?: string;
  className?: string;
}

// Catmull-Rom spline generator for smooth area/line curves
function catmullRom2bezier(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export const ComposedChart: React.FC<ComposedChartProps> = ({
  data,
  maxBarSize = 32,
  barGap = 4,
  className = '',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const linePathRef = useRef<SVGPathElement>(null);
  const areaPathRef = useRef<SVGPathElement>(null);

  const width = 800;
  const height = 280;
  const padding = { top: 20, right: 45, bottom: 40, left: 45 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Max scale for left Y-axis (Transactions Volume)
  const maxVolume = Math.max(...(data || []).map((d) => d.totalTransactions || 0), 100);
  const maxVolumePadded = Math.ceil(maxVolume * 1.15);

  // Max scale for right Y-axis (Anomaly Rate %)
  const maxRate = Math.max(...(data || []).map((d) => d.anomalyRate || 0), 5);
  const maxRatePadded = Math.ceil(maxRate * 1.25);

  const stepX = (data && data.length > 0) ? plotWidth / data.length : 10;
  const barWidth = Math.min(maxBarSize, Math.max(12, stepX - barGap * 2));

  // Compute coordinates for line and area
  const linePoints = (data || []).map((d, i) => {
    const x = padding.left + i * stepX + stepX / 2;
    const y = padding.top + plotHeight - ((d.anomalyRate || 0) / maxRatePadded) * plotHeight;
    return { x, y };
  });

  const baselinePoints = (data || []).map((d, i) => {
    const x = padding.left + i * stepX + stepX / 2;
    const y = padding.top + plotHeight - ((d.baselineThreshold || 0) / maxVolumePadded) * plotHeight;
    return { x, y };
  });

  const linePath = catmullRom2bezier(linePoints);
  const baselineCurve = catmullRom2bezier(baselinePoints);

  const areaPath = baselinePoints.length > 0
    ? `${baselineCurve} L ${baselinePoints[baselinePoints.length - 1].x} ${padding.top + plotHeight} L ${baselinePoints[0].x} ${padding.top + plotHeight} Z`
    : '';

  // anime.js smooth entrance animation
  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    // Animate bars staggered rising up
    anime({
      targets: containerRef.current.querySelectorAll('.chart-bar-rect'),
      scaleY: [0, 1],
      opacity: [0, 1],
      easing: 'easeOutQuad',
      duration: 650,
      delay: anime.stagger(28),
      transformOrigin: '50% 100%',
    });

    // Animate path line stroke drawing from left to right
    if (linePathRef.current) {
      anime({
        targets: linePathRef.current,
        strokeDashoffset: [anime.setDashoffset, 0],
        easing: 'easeOutCubic',
        duration: 1100,
      });
    }

    // Animate area fill fade-in
    if (areaPathRef.current) {
      anime({
        targets: areaPathRef.current,
        opacity: [0, 1],
        easing: 'easeOutQuad',
        duration: 900,
      });
    }
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-500 font-mono">
        No time-series telemetry available
      </div>
    );
  }

  const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div ref={containerRef} className={`relative w-full overflow-hidden select-none ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        style={{ maxHeight: '340px' }}
      >
        <defs>
          <linearGradient id="composedAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818CF8" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0.02" />
          </linearGradient>

          <linearGradient id="composedBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.75" />
          </linearGradient>

          <linearGradient id="composedBarHover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A5B4FC" stopOpacity="1" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.9" />
          </linearGradient>

          <filter id="composedGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + plotHeight * (1 - ratio);
          const volLabel = Math.round(maxVolumePadded * ratio);
          const rateLabel = (maxRatePadded * ratio).toFixed(1) + '%';
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="rgba(148, 163, 184, 0.12)"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                fill="#94A3B8"
                fontSize="10"
                textAnchor="end"
                fontFamily="monospace"
              >
                {volLabel}
              </text>
              <text
                x={width - padding.right + 8}
                y={y + 3}
                fill="#F43F5E"
                fontSize="10"
                textAnchor="start"
                fontFamily="monospace"
              >
                {rateLabel}
              </text>
            </g>
          );
        })}

        {/* Baseline Tolerance Area */}
        {areaPath && (
          <path ref={areaPathRef} d={areaPath} fill="url(#composedAreaGradient)" />
        )}

        {/* SeriesBar: Transaction Volume Bars */}
        {data.map((d, i) => {
          const barHeight = ((d.totalTransactions || 0) / maxVolumePadded) * plotHeight;
          const x = padding.left + i * stepX + (stepX - barWidth) / 2;
          const y = padding.top + plotHeight - barHeight;
          const isHovered = hoveredIndex === i;
          const isDimmed = hoveredIndex !== null && hoveredIndex !== i;

          return (
            <g key={i}>
              <rect
                className="chart-bar-rect transition-opacity duration-150 cursor-pointer"
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx={4}
                fill={isHovered ? 'url(#composedBarHover)' : 'url(#composedBarGradient)'}
                opacity={isDimmed ? 0.35 : 1}
              />
              {(i % 2 === 0 || data.length <= 12) && (
                <text
                  x={x + barWidth / 2}
                  y={height - 12}
                  fill="#94A3B8"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {d.timestamp}
                </text>
              )}
            </g>
          );
        })}

        {/* Anomaly Rate Line */}
        {linePath && (
          <path
            ref={linePathRef}
            d={linePath}
            fill="none"
            stroke="#F43F5E"
            strokeWidth="2.5"
            filter="url(#composedGlow)"
          />
        )}

        {/* Scatter Ring Markers */}
        {linePoints.map((pt, i) => {
          const isHovered = hoveredIndex === i;
          return (
            <g key={i}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 5.5 : 3.5}
                fill="#08090C"
                stroke="#F43F5E"
                strokeWidth={isHovered ? 2.5 : 1.8}
                className="transition-all duration-150"
              />
              {isHovered && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={9}
                  fill="#F43F5E"
                  opacity={0.25}
                />
              )}
            </g>
          );
        })}

        {/* Transparent Interactive Columns for Hover Tracking */}
        {data.map((_, i) => {
          const x = padding.left + i * stepX;
          return (
            <rect
              key={`hitbox-${i}`}
              x={x}
              y={padding.top}
              width={stepX}
              height={plotHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredData && hoveredIndex !== null && (
        <div
          className="absolute z-20 pointer-events-none rounded-lg p-2.5 shadow-2xl border bg-slate-900/95 border-slate-700 text-slate-100 backdrop-blur-md transition-transform"
          style={{
            left: `${Math.min(Math.max(hoveredIndex * (100 / data.length), 8), 76)}%`,
            top: '8px',
          }}
        >
          <div className="text-[11px] font-mono font-bold text-indigo-300 mb-1 flex items-center justify-between gap-4">
            <span>Interval: {hoveredData.timestamp}</span>
            <span className="text-slate-400 font-normal">24h Window</span>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1 text-indigo-400">
                <span className="w-2 h-2 rounded-sm bg-indigo-500" />
                Volume:
              </span>
              <span className="font-bold text-slate-100">{hoveredData.totalTransactions.toLocaleString()} txs</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Anomalies:
              </span>
              <span className="font-bold text-rose-300">{hoveredData.anomalies}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-1 mt-1">
              <span className="text-slate-400">Anomaly Rate:</span>
              <span className="font-bold text-amber-300">{hoveredData.anomalyRate.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComposedChart;
