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
  const linePart = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  return `${linePart} L${last.x.toFixed(2)},${(SPARKLINE_H - SPARK_PAD.bottom).toFixed(2)} L${first.x.toFixed(2)},${(SPARKLINE_H - SPARK_PAD.bottom).toFixed(2)} Z`;
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(0);
}

export default function ThroughputWidget() {
  const metrics = useMetricsStore((s) => s.metrics);
  const throughputHistory = useMetricsStore((s) => s.throughputHistory);

  const ticksPerSec = metrics?.throughputPerSecond ?? 0;
  const totalTicks = metrics?.totalTicksProcessed ?? 0;

  const sparkPath = useMemo(() => buildSparklinePath(throughputHistory), [throughputHistory]);
  const areaPath = useMemo(() => buildAreaPath(throughputHistory), [throughputHistory]);

  // Color throughput based on velocity
  const throughputColor = ticksPerSec > 1000 ? '#22c55e' : ticksPerSec > 100 ? '#3b82f6' : '#94a3b8';

  return (
    <div className="flex flex-col gap-1 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-wider uppercase text-[#64748b]">THROUGHPUT</span>
        <div className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: throughputColor }}
          />
        </div>
      </div>

      {/* Primary metric */}
      <div className="flex items-end gap-1">
        <span className="font-mono text-lg font-semibold" style={{ color: throughputColor }}>
          {formatLargeNumber(ticksPerSec)}
        </span>
        <span className="text-[10px] tracking-wider uppercase text-[#64748b] mb-0.5">TICKS/SEC</span>
      </div>

      {/* Sparkline */}
      <div className="relative w-full" style={{ height: `${SPARKLINE_H}px` }}>
        <svg
          viewBox={`0 0 ${SPARKLINE_W} ${SPARKLINE_H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {areaPath && (
            <path d={areaPath} fill={throughputColor} opacity={0.1} />
          )}
          {sparkPath && (
            <path
              d={sparkPath}
              fill="none"
              stroke={throughputColor}
              strokeWidth={1.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
      </div>

      {/* Total processed */}
      <div className="flex items-center justify-between border-t border-[#252930] pt-1">
        <span className="text-[10px] tracking-wider uppercase text-[#64748b]">TOTAL PROCESSED</span>
        <span className="font-mono text-xs text-[#e2e8f0]">
          {formatLargeNumber(totalTicks)}
          <span className="text-[9px] text-[#64748b] ml-0.5">ticks</span>
        </span>
      </div>

      {/* Active feeds */}
      {metrics?.activeFeeds !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-wider uppercase text-[#64748b]">ACTIVE FEEDS</span>
          <span className="font-mono text-xs text-[#3b82f6]">{metrics.activeFeeds}</span>
        </div>
      )}
    </div>
  );
}
