import React, { useEffect, useRef } from 'react';
import anime from 'animejs';

export interface CategoryBarItem {
  category: string;
  count: number;
  percentage: number;
  color?: string;
}

export interface HorizontalBarChartProps {
  data: CategoryBarItem[];
  className?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const maxCount = Math.max(...(data || []).map((d) => d.count), 1);

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    data.forEach((item, idx) => {
      const barWidth = Math.max((item.count / maxCount) * 100, 3);
      anime({
        targets: `#bar-fill-${idx}`,
        width: ['0%', `${barWidth}%`],
        easing: 'easeOutQuart',
        duration: 750 + idx * 60,
        delay: idx * 40,
      });
    });
  }, [data, maxCount]);

  return (
    <div ref={containerRef} className={`space-y-3 ${className}`}>
      {data.map((item, idx) => {
        const color = item.color || '#6366F1';

        return (
          <div key={idx} className="space-y-1 group">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 group-hover:text-indigo-300 transition-colors truncate max-w-[280px]">
                {item.category}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100">{item.count}</span>
                <span className="text-[11px] text-slate-500 font-mono">({item.percentage.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800/80 overflow-hidden">
              <div
                id={`bar-fill-${idx}`}
                className="h-full rounded-full"
                style={{
                  width: '0%',
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HorizontalBarChart;
