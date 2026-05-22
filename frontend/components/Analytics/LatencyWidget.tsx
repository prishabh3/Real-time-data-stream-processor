'use client';

import React, { useMemo } from 'react';
import { useMetricsStore } from '@/store/metricsStore';

const SPARKLINE_W = 120;
const SPARKLINE_H = 40;
const SPARK_PAD = { top: 2, bottom: 2 };

function buildSparklinePath(history: { timestamp: number; value: number }[], maxPoints = 60): string {
  const slice = history.slice(-maxPoints);
  if (slice.length < 2) return '';
  const values = slice.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = SPARKLINE_W / (slice.length - 1);
  return slice
    .map((p, i) => {
      const x = (i * xStep).toFixed(2);
      const y = (
        SPARK_PAD.top +
        ((max - p.value) / range) * (SPARKLINE_H - SPARK_PAD.top - SPARK_PAD.bottom)
      ).toFixed(2);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

function buildAreaPath(history: { timestamp: number; value: number }[], maxPoints = 60): string {
  const slice = history.slice(-maxPoints);
  if (slice.length < 2) return '';
  const values = slice.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = SPARKLINE_W / (slice.length - 1);
  const points = slice.map((p, i) => {
    const x = i * xStep;
    const y =
      SPARK_PAD.top +
      ((max - p.value) / range) * (SPARKLINE_H - SPARK_PAD.top - SPARK_PAD.bottom);
    return { x, y };
  });
  const linePart = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  return `${linePart} L${last.x.toFixed(2)},${(SPARKLINE_H - SPARK_PAD.bottom).toFixed(2)} L${first.x.toFixed(2)},${(SPARKLINE_H - SPARK_PAD.bottom).toFixed(2)} Z`;
}

function LatencyIndicator({ value }: { value: number }) {
  if (value < 1) return <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block" />;
  if (value <= 5) return <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" />;
}

function latencyColor(value: number): string {
  if (value < 1) return 'text-[#22c55e]';
  if (value <= 5) return 'text-[#f59e0b]';
  return 'text-[#ef4444]';
}

export default function LatencyWidget() {
  const metrics = useMetricsStore((s) => s.metrics);
  const latencyHistory = useMetricsStore((s) => s.latencyHistory);

  const avg = metrics?.averageLatencyMs ?? 0;
  const peak = metrics?.peakLatencyMs ?? 0;

  const sparkPath = useMemo(() => buildSparklinePath(latencyHistory), [latencyHistory]);
  const areaPath = useMemo(() => buildAreaPath(latencyHistory), [latencyHistory]);

  const lineColor = avg < 1 ? '#22c55e' : avg <= 5 ? '#f59e0b' : '#ef4444';
  const avgColor = latencyColor(avg);

  return (
    <div className="flex flex-col gap-1 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <LatencyIndicator value={avg} />
          <span className="text-[10px] tracking-wider uppercase text-[#64748b]">AVG LATENCY</span>
        </div>
        <span className={`font-mono text-sm font-semibold ${avgColor}`}>
          {avg.toFixed(3)}<span className="text-[10px] font-normal text-[#64748b] ml-0.5">ms</span>
        </span>
      </div>

      {/* Peak */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-wider uppercase text-[#64748b]">PEAK</span>
        <span className="font-mono text-xs text-[#f59e0b]">
          {peak.toFixed(3)}<span className="text-[9px] text-[#64748b] ml-0.5">ms</span>
        </span>
      </div>

      {/* Sparkline */}
      <div className="relative w-full" style={{ height: `${SPARKLINE_H}px` }}>
        <svg
          viewBox={`0 0 ${SPARKLINE_W} ${SPARKLINE_H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill={lineColor} opacity={0.1} />
          )}
          {/* Line */}
          {sparkPath && (
            <path
              d={sparkPath}
              fill="none"
              stroke={lineColor}
              strokeWidth={1.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {/* Threshold lines */}
          {(() => {
            if (latencyHistory.length < 2) return null;
            const values = latencyHistory.map((p) => p.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min || 1;
            const toY = (v: number) =>
              SPARK_PAD.top + ((max - Math.min(max, Math.max(min, v))) / range) *
              (SPARKLINE_H - SPARK_PAD.top - SPARK_PAD.bottom);

            const lines = [];
            if (min <= 1 && max >= 1) {
              lines.push(
                <line key="t1" x1={0} y1={toY(1)} x2={SPARKLINE_W} y2={toY(1)}
                  stroke="#f59e0b" strokeWidth={0.4} strokeDasharray="2,2" opacity={0.5} />
              );
            }
            if (min <= 5 && max >= 5) {
              lines.push(
                <line key="t5" x1={0} y1={toY(5)} x2={SPARKLINE_W} y2={toY(5)}
                  stroke="#ef4444" strokeWidth={0.4} strokeDasharray="2,2" opacity={0.5} />
              );
            }
            return lines;
          })()}
        </svg>
      </div>

      {/* Status label */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-[#64748b]">60s HISTORY</span>
        <span className={`text-[9px] font-mono ${avgColor}`}>
          {avg < 1 ? 'OPTIMAL' : avg <= 5 ? 'ELEVATED' : 'CRITICAL'}
        </span>
      </div>
    </div>
  );
}
