import React, { useState, useEffect, useRef } from 'react';
import anime from 'animejs';

export interface RingDataItem {
  label: string;
  value: number;
  maxValue?: number;
  color: string;
}

export interface RingChartProps {
  data: RingDataItem[];
  size?: number;
  strokeWidth?: number;
  ringGap?: number;
  baseInnerRadius?: number;
  centerTitle?: string;
  centerValue?: string | number;
  className?: string;
}

export const RingChart: React.FC<RingChartProps> = ({
  data,
  size = 260,
  strokeWidth = 14,
  ringGap = 6,
  baseInnerRadius = 48,
  centerTitle = 'Open Queue',
  centerValue,
  className = '',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const centerValueRef = useRef<HTMLSpanElement>(null);

  const center = size / 2;
  const totalValue = data.reduce((acc, item) => acc + item.value, 0);
  const maxRef = Math.max(...data.map((d) => d.maxValue || totalValue || 100), 1);

  // anime.js arc progress and center counter animation
  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    // Animate each SVG ring arc stroke
    data.forEach((item, index) => {
      const radius = baseInnerRadius + index * (strokeWidth + ringGap);
      const circumference = 2 * Math.PI * radius;
      const percentage = Math.min(Math.max(item.value / (item.maxValue || maxRef), 0), 1);
      const targetOffset = circumference * (1 - percentage);

      anime({
        targets: `#ring-arc-${index}`,
        strokeDashoffset: [circumference, targetOffset],
        easing: 'easeOutQuart',
        duration: 950 + index * 120,
      });
    });

    // Animate center counter if numeric
    const numericCenter = typeof centerValue === 'number' ? centerValue : (typeof centerValue === 'string' && !isNaN(parseInt(centerValue)) ? parseInt(centerValue) : totalValue);
    const counterObj = { val: 0 };

    anime({
      targets: counterObj,
      val: numericCenter,
      round: 1,
      easing: 'easeOutExpo',
      duration: 1000,
      update: () => {
        if (centerValueRef.current && hoveredIndex === null) {
          centerValueRef.current.innerText = typeof centerValue === 'string' && centerValue.includes('Active')
            ? `${counterObj.val} Active`
            : counterObj.val.toLocaleString();
        }
      },
    });
  }, [data, centerValue, baseInnerRadius, strokeWidth, ringGap, maxRef, totalValue, hoveredIndex]);

  const activeItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div ref={containerRef} className={`flex flex-col items-center justify-center select-none ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          <defs>
            {data.map((_, idx) => (
              <filter key={`glow-${idx}`} id={`glow-${idx}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            ))}
          </defs>

          {data.map((item, index) => {
            const radius = baseInnerRadius + index * (strokeWidth + ringGap);
            const circumference = 2 * Math.PI * radius;
            const isHovered = hoveredIndex === index;
            const isDimmed = hoveredIndex !== null && hoveredIndex !== index;

            return (
              <g
                key={item.label}
                className="cursor-pointer transition-all duration-300"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Background Track */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.12)"
                  strokeWidth={strokeWidth}
                />

                {/* Animated Progress Arc */}
                <circle
                  id={`ring-arc-${index}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${center} ${center})`}
                  opacity={isDimmed ? 0.35 : 1}
                  filter={isHovered ? `url(#glow-${index})` : undefined}
                />
              </g>
            );
          })}
        </svg>

        {/* RingCenter: Display Total or Active Hover Item */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {activeItem ? activeItem.label : centerTitle}
          </span>
          <span
            ref={centerValueRef}
            className="text-2xl font-black tracking-tight text-slate-100 mt-0.5"
          >
            {activeItem ? activeItem.value.toLocaleString() : (centerValue !== undefined ? centerValue : totalValue.toLocaleString())}
          </span>
          {activeItem && (
            <span className="text-[10px] font-mono text-emerald-400 mt-0.5 font-semibold">
              {((activeItem.value / (totalValue || 1)) * 100).toFixed(1)}% of total
            </span>
          )}
        </div>
      </div>

      {/* RingLegend */}
      <div className="w-full grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80">
        {data.map((item, idx) => {
          const isHovered = hoveredIndex === idx;
          return (
            <div
              key={item.label}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`p-2 rounded-lg text-center cursor-pointer transition-all duration-200 ${
                isHovered ? 'bg-slate-800/80 ring-1 ring-slate-600' : 'bg-slate-950/40 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] font-medium text-slate-400 truncate">{item.label}</span>
              </div>
              <div className="text-sm font-bold text-slate-200">{item.value.toLocaleString()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RingChart;
