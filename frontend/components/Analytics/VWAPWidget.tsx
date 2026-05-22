import React from 'react';

interface VWAPWidgetProps {
  vwap: number;
  currentPrice: number;
  sma20: number;
  sma50: number;
  ema20: number;
  volatility: number;
}

function formatNum(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(3)}%`;
}

export default function VWAPWidget({
  vwap,
  currentPrice,
  sma20,
  sma50,
  ema20,
  volatility,
}: VWAPWidgetProps) {
  const deviation = currentPrice - vwap;
  const deviationPct = vwap !== 0 ? (deviation / vwap) * 100 : 0;
  const isAbove = deviation >= 0;

  // Normalize deviation for bar display: cap at ±2% for visual range
  const MAX_DEV_PCT = 2;
  const normalizedDev = Math.min(1, Math.max(-1, deviationPct / MAX_DEV_PCT));
  // Bar: center is 50%, positive goes right, negative goes left
  const barLeft = normalizedDev < 0 ? (0.5 + normalizedDev) * 100 : 50;
  const barWidth = Math.abs(normalizedDev) * 50;
  const barColor = isAbove ? '#22c55e' : '#ef4444';

  const devColor = isAbove ? 'text-[#22c55e]' : 'text-[#ef4444]';

  const smaRows: { label: string; value: string; diff: number }[] = [
    { label: 'SMA20', value: formatNum(sma20), diff: currentPrice - sma20 },
    { label: 'SMA50', value: formatNum(sma50), diff: currentPrice - sma50 },
    { label: 'EMA20', value: formatNum(ema20), diff: currentPrice - ema20 },
  ];

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <span className="text-[10px] tracking-wider uppercase text-[#64748b]">VWAP &amp; MAs</span>

      {/* VWAP main value */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] tracking-wider uppercase text-[#64748b]">VWAP</span>
          <span className="font-mono text-sm text-[#e2e8f0]">{formatNum(vwap)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] tracking-wider uppercase text-[#64748b]">DEVIATION</span>
          <span className={`font-mono text-xs ${devColor}`}>
            {isAbove ? '+' : ''}{formatNum(deviation)} ({formatPct(deviationPct)})
          </span>
        </div>
      </div>

      {/* Deviation bar */}
      <div className="flex flex-col gap-0.5">
        <div className="relative w-full h-1.5 rounded-full bg-[#252930] overflow-hidden">
          {/* Center line */}
          <div className="absolute top-0 bottom-0 w-px bg-[#64748b] opacity-50" style={{ left: '50%' }} />
          {/* Deviation fill */}
          <div
            className="absolute top-0 bottom-0 rounded-full transition-all duration-300"
            style={{
              left: `${barLeft}%`,
              width: `${barWidth}%`,
              backgroundColor: barColor,
              opacity: 0.8,
            }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[8px] font-mono text-[#ef4444]">−{MAX_DEV_PCT}%</span>
          <span className="text-[8px] font-mono text-[#64748b]">VWAP</span>
          <span className="text-[8px] font-mono text-[#22c55e]">+{MAX_DEV_PCT}%</span>
        </div>
      </div>

      {/* Moving averages grid */}
      <div className="grid grid-cols-3 gap-1 mt-0.5">
        {smaRows.map((row) => {
          const diffColor = row.diff >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]';
          return (
            <div key={row.label} className="flex flex-col">
              <span className="text-[9px] tracking-wider uppercase text-[#64748b]">{row.label}</span>
              <span className="font-mono text-xs text-[#e2e8f0]">{row.value}</span>
              <span className={`font-mono text-[9px] ${diffColor}`}>
                {row.diff >= 0 ? '+' : ''}{formatNum(row.diff)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Volatility */}
      <div className="flex items-center justify-between border-t border-[#252930] pt-1 mt-0.5">
        <span className="text-[9px] tracking-wider uppercase text-[#64748b]">VOLATILITY (σ)</span>
        <span className="font-mono text-xs text-[#f59e0b]">{(volatility * 100).toFixed(3)}%</span>
      </div>
    </div>
  );
}
