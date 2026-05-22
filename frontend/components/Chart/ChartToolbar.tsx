"use client";

import { useEffect, useRef, useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import type { Timeframe } from "@/lib/types";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1H", "4H", "1D"];

export default function ChartToolbar() {
  const { activeSymbol, timeframe, setTimeframe, showSMA, showEMA, showBollinger, showVWAP, toggleIndicator } =
    useMarketStore();

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#252930] bg-[#111318] h-9 shrink-0">
      {/* Timeframe selector */}
      <div className="flex items-center gap-0.5">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-2 py-0.5 text-[11px] font-mono rounded-sm transition-colors ${
              timeframe === tf
                ? "bg-[#1d2433] text-[#3b82f6] font-semibold"
                : "text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1a1d23]"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[#252930] mx-2" />

      {/* Indicator toggles */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] uppercase tracking-wider text-[#64748b] mr-1">Indicators</span>
        <IndicatorToggle
          label="SMA"
          active={showSMA}
          color="#f59e0b"
          onClick={() => toggleIndicator("showSMA")}
        />
        <IndicatorToggle
          label="EMA"
          active={showEMA}
          color="#34d399"
          onClick={() => toggleIndicator("showEMA")}
        />
        <IndicatorToggle
          label="BB"
          active={showBollinger}
          color="#3b82f6"
          onClick={() => toggleIndicator("showBollinger")}
        />
        <IndicatorToggle
          label="VWAP"
          active={showVWAP}
          color="#a78bfa"
          onClick={() => toggleIndicator("showVWAP")}
        />
      </div>

      {/* Chart type — placeholder for extensibility */}
      <div className="flex items-center gap-2 ml-auto">
        <button className="text-[10px] text-[#64748b] hover:text-[#94a3b8] flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="3" width="2" height="6" fill="currentColor" opacity="0.6" />
            <rect x="0" y="4.5" width="4" height="1" fill="currentColor" />
            <rect x="5" y="1" width="2" height="8" fill="currentColor" opacity="0.6" />
            <rect x="4" y="2.5" width="4" height="1" fill="currentColor" />
            <rect x="9" y="4" width="2" height="5" fill="currentColor" opacity="0.6" />
            <rect x="8" y="5.5" width="4" height="1" fill="currentColor" />
          </svg>
          Candles
        </button>
        <button
          title="Reset zoom (R)"
          className="text-[10px] text-[#64748b] hover:text-[#94a3b8] px-1.5 py-0.5 rounded border border-[#252930] hover:border-[#374151]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function IndicatorToggle({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border transition-all ${
        active
          ? "border-transparent bg-[#1a1d23] text-[#e2e8f0]"
          : "border-transparent text-[#64748b] hover:text-[#94a3b8]"
      }`}
    >
      <span
        className="w-2 h-0.5 rounded-full"
        style={{ background: active ? color : "#374151" }}
      />
      {label}
    </button>
  );
}
