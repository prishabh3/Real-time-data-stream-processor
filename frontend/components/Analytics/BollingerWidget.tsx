import React from 'react';
import type { BollingerBands } from '@/lib/types';

interface BollingerWidgetProps {
  bollinger: BollingerBands | null;
  currentPrice: number;
}

export default function BollingerWidget({ bollinger, currentPrice }: BollingerWidgetProps) {
  if (!bollinger) {
    return (
      <div className="flex flex-col gap-1.5 p-2">
        <span className="text-[10px] tracking-wider uppercase text-[#64748b]">BOLLINGER BANDS</span>
        <span className="text-[10px] text-[#64748b] font-mono">Calculating…</span>
      </div>
    );
  }

  const { upper, middle, lower, bandwidth } = bollinger;

  // Compute current price position within bands (0 = at lower, 1 = at upper)
  const range = upper - lower;
  const rawPosition = range > 0 ? (currentPrice - lower) / range : 0.5;
  const position = Math.min(1, Math.max(0, rawPosition));
  const positionPct = (position * 100).toFixed(1);

  // Color based on position
  const posColor =
    position > 0.8
      ? 'text-[#ef4444]'
      : position < 0.2
      ? 'text-[#22c55e]'
      : 'text-[#e2e8f0]';

  const barFillColor =
    position > 0.8 ? '#ef4444' : position < 0.2 ? '#22c55e' : '#3b82f6';

  const rows: { label: string; value: string; color?: string }[] = [
    { label: 'UPPER', value: upper.toFixed(2), color: 'text-[#ef4444]' },
    { label: 'MIDDLE (SMA20)', value: middle.toFixed(2), color: 'text-[#94a3b8]' },
    { label: 'LOWER', value: lower.toFixed(2), color: 'text-[#22c55e]' },
    { label: 'BANDWIDTH', value: (bandwidth * 100).toFixed(2) + '%', color: 'text-[#f59e0b]' },
  ];

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <span className="text-[10px] tracking-wider uppercase text-[#64748b]">BOLLINGER BANDS (20,2)</span>

      {/* Value grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col">
            <span className="text-[9px] tracking-wider text-[#64748b] uppercase leading-none">{row.label}</span>
            <span className={`font-mono text-xs ${row.color ?? 'text-[#e2e8f0]'}`}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Position within bands */}
      <div className="flex flex-col gap-0.5 mt-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] tracking-wider uppercase text-[#64748b]">% B POSITION</span>
          <span className={`font-mono text-xs ${posColor}`}>{positionPct}%</span>
        </div>
        {/* Progress bar */}
        <div className="relative w-full h-1.5 rounded-full bg-[#252930] overflow-hidden">
          {/* Zone markers */}
          <div
            className="absolute top-0 bottom-0 w-px bg-[#ef4444] opacity-40"
            style={{ left: '80%' }}
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-[#22c55e] opacity-40"
            style={{ left: '20%' }}
          />
          {/* Fill bar */}
          <div
            className="absolute top-0 left-0 bottom-0 rounded-full transition-all duration-300"
            style={{ width: `${position * 100}%`, backgroundColor: barFillColor }}
          />
          {/* Indicator dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-[#0d0f12] transition-all duration-300"
            style={{ left: `calc(${position * 100}% - 4px)`, backgroundColor: barFillColor }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[8px] text-[#22c55e] font-mono">{lower.toFixed(2)}</span>
          <span className="text-[8px] text-[#94a3b8] font-mono">{currentPrice.toFixed(2)}</span>
          <span className="text-[8px] text-[#ef4444] font-mono">{upper.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
