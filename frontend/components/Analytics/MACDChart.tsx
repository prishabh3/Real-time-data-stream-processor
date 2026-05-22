'use client';

import React, { useMemo } from 'react';
import type { MACDResult } from '@/lib/types';

interface MACDDataPoint {
  time: number;
  macdLine: number;
  signalLine: number;
  histogram: number;
}

interface MACDChartProps {
  data: MACDDataPoint[];
  current: MACDResult;
}

const WIDTH = 120;
const HEIGHT = 40;
const PADDING = { top: 2, bottom: 2, left: 0, right: 0 };

function normalize(value: number, min: number, max: number): number {
  if (max === min) return HEIGHT / 2;
  const range = max - min;
  const clamp = Math.min(max, Math.max(min, value));
  return (
    PADDING.top +
    ((max - clamp) / range) * (HEIGHT - PADDING.top - PADDING.bottom)
  );
}

export default function MACDChart({ data, current }: MACDChartProps) {
  const { histBars, macdPath, signalPath, zeroY } = useMemo(() => {
    if (data.length === 0) {
      return { histBars: [], macdPath: '', signalPath: '', zeroY: HEIGHT / 2 };
    }

    // Compute global min/max across all series
    const allValues = data.flatMap((d) => [d.macdLine, d.signalLine, d.histogram]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    const xStep = WIDTH / Math.max(data.length - 1, 1);
    const barWidth = Math.max(1, xStep * 0.7);
    const zY = normalize(0, min, max);

    // Histogram bars
    const bars = data.map((d, i) => {
      const x = i * xStep;
      const y = normalize(d.histogram, min, max);
      const barH = Math.abs(y - zY);
      const isPositive = d.histogram >= 0;
      return {
        x: x - barWidth / 2,
        y: isPositive ? y : zY,
        height: Math.max(0.5, barH),
        color: isPositive ? '#22c55e' : '#ef4444',
      };
    });

    // MACD line
    const macdPts = data
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${(i * xStep).toFixed(2)},${normalize(d.macdLine, min, max).toFixed(2)}`)
      .join(' ');

    // Signal line
    const sigPts = data
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${(i * xStep).toFixed(2)},${normalize(d.signalLine, min, max).toFixed(2)}`)
      .join(' ');

    return { histBars: bars, macdPath: macdPts, signalPath: sigPts, zeroY: zY };
  }, [data]);

  const histColor = current.histogram >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]';

  return (
    <div className="flex flex-col gap-1">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-0.5">
        <span className="text-[10px] tracking-wider uppercase text-[#64748b]">MACD (12,26,9)</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#3b82f6]">
            M:{current.macdLine >= 0 ? '+' : ''}{current.macdLine.toFixed(3)}
          </span>
          <span className="text-[10px] font-mono text-[#f59e0b]">
            S:{current.signalLine >= 0 ? '+' : ''}{current.signalLine.toFixed(3)}
          </span>
          <span className={`text-[10px] font-mono ${histColor}`}>
            H:{current.histogram >= 0 ? '+' : ''}{current.histogram.toFixed(3)}
          </span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full" style={{ height: `${HEIGHT + 4}px` }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Zero line */}
          <line
            x1={0}
            y1={zeroY}
            x2={WIDTH}
            y2={zeroY}
            stroke="#64748b"
            strokeWidth={0.4}
            opacity={0.5}
          />

          {/* Histogram bars */}
          {histBars.map((bar, i) => (
            <rect
              key={i}
              x={bar.x}
              y={bar.y}
              width={Math.max(1, WIDTH / Math.max(data.length - 1, 1) * 0.7)}
              height={bar.height}
              fill={bar.color}
              opacity={0.7}
            />
          ))}

          {/* MACD line (blue) */}
          {macdPath && (
            <path
              d={macdPath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Signal line (orange) */}
          {signalPath && (
            <path
              d={signalPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={1}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="2,1"
            />
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-[#3b82f6]" />
          <span className="text-[9px] text-[#64748b]">MACD</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-[#f59e0b]" style={{ backgroundImage: 'repeating-linear-gradient(to right, #f59e0b 0, #f59e0b 3px, transparent 3px, transparent 5px)' }} />
          <span className="text-[9px] text-[#64748b]">SIGNAL</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-[#22c55e] opacity-70" />
          <span className="text-[9px] text-[#64748b]">HIST</span>
        </span>
      </div>
    </div>
  );
}
