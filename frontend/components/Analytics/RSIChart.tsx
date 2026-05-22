'use client';

import React, { useMemo } from 'react';

interface RSIDataPoint {
  time: number;
  value: number;
}

interface RSIChartProps {
  data: RSIDataPoint[];
  current: number;
}

const WIDTH = 120;
const HEIGHT = 40;
const OVERBOUGHT = 70;
const OVERSOLD = 30;
const PADDING = { top: 2, bottom: 2, left: 0, right: 0 };

function rsiToY(value: number): number {
  const clamp = Math.min(100, Math.max(0, value));
  return (
    PADDING.top +
    ((100 - clamp) / 100) * (HEIGHT - PADDING.top - PADDING.bottom)
  );
}

export default function RSIChart({ data, current }: RSIChartProps) {
  const { linePath, overboughtY, oversoldY, isOverbought, isOversold, segments } = useMemo(() => {
    const ob = rsiToY(OVERBOUGHT);
    const os = rsiToY(OVERSOLD);
    const ovb = current > OVERBOUGHT;
    const ovs = current < OVERSOLD;

    if (data.length === 0) {
      return { linePath: '', overboughtY: ob, oversoldY: os, isOverbought: ovb, isOversold: ovs, segments: [] };
    }

    const xStep = WIDTH / Math.max(data.length - 1, 1);

    // Build polyline points
    const points = data.map((d, i) => ({
      x: i * xStep,
      y: rsiToY(d.value),
      value: d.value,
    }));

    // Build path string
    const pathStr = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');

    return {
      linePath: pathStr,
      overboughtY: ob,
      oversoldY: os,
      isOverbought: ovb,
      isOversold: ovs,
      segments: points,
    };
  }, [data, current]);

  const lineColor = isOverbought
    ? '#ef4444'
    : isOversold
    ? '#f59e0b'
    : '#22c55e';

  const currentLabel = current.toFixed(1);
  const statusLabel = isOverbought ? 'OVERBOUGHT' : isOversold ? 'OVERSOLD' : 'NEUTRAL';
  const statusColor = isOverbought ? 'text-[#ef4444]' : isOversold ? 'text-[#f59e0b]' : 'text-[#22c55e]';

  return (
    <div className="flex flex-col gap-1">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-wider uppercase text-[#64748b]">RSI (14)</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] tracking-wider uppercase font-mono ${statusColor}`}>
            {statusLabel}
          </span>
          <span className={`font-mono text-sm font-semibold ${statusColor}`}>
            {currentLabel}
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
          {/* Overbought zone fill */}
          <rect
            x={0}
            y={PADDING.top}
            width={WIDTH}
            height={overboughtY - PADDING.top}
            fill="#ef4444"
            opacity={0.06}
          />

          {/* Oversold zone fill */}
          <rect
            x={0}
            y={oversoldY}
            width={WIDTH}
            height={HEIGHT - PADDING.bottom - oversoldY}
            fill="#22c55e"
            opacity={0.06}
          />

          {/* Overbought line */}
          <line
            x1={0}
            y1={overboughtY}
            x2={WIDTH}
            y2={overboughtY}
            stroke="#ef4444"
            strokeWidth={0.5}
            strokeDasharray="2,2"
            opacity={0.6}
          />

          {/* Midline (50) */}
          <line
            x1={0}
            y1={rsiToY(50)}
            x2={WIDTH}
            y2={rsiToY(50)}
            stroke="#64748b"
            strokeWidth={0.4}
            strokeDasharray="1,3"
            opacity={0.4}
          />

          {/* Oversold line */}
          <line
            x1={0}
            y1={oversoldY}
            x2={WIDTH}
            y2={oversoldY}
            stroke="#22c55e"
            strokeWidth={0.5}
            strokeDasharray="2,2"
            opacity={0.6}
          />

          {/* RSI line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth={1.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Current value dot */}
          {segments.length > 0 && (
            <circle
              cx={segments[segments.length - 1].x}
              cy={segments[segments.length - 1].y}
              r={1.5}
              fill={lineColor}
            />
          )}

          {/* Level labels */}
          <text x={1} y={overboughtY - 1} fontSize={4} fill="#ef4444" opacity={0.7}>70</text>
          <text x={1} y={oversoldY + 4} fontSize={4} fill="#22c55e" opacity={0.7}>30</text>
        </svg>
      </div>
    </div>
  );
}
