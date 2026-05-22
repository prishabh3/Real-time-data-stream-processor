"use client";

import { useEffect, useRef, useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { SYMBOL_META } from "@/lib/mock/marketSimulator";

function formatPrice(price: number, decimals: number = 2): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function PriceTicker() {
  const { activeSymbol, lastPrices, candles, timeframe } = useMarketStore();
  const price = lastPrices[activeSymbol] ?? 0;
  const prevPriceRef = useRef<number>(price);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  const candleKey = `${activeSymbol}:${timeframe}`;
  const candleData = candles[candleKey] ?? [];
  const firstCandle = candleData[0];
  const change = firstCandle ? price - firstCandle.open : 0;
  const changePct = firstCandle && firstCandle.open ? (change / firstCandle.open) * 100 : 0;
  const isUp = change >= 0;

  const meta = SYMBOL_META[activeSymbol] ?? {};

  // Flash on price change
  useEffect(() => {
    if (price === prevPriceRef.current) return;
    const direction = price > prevPriceRef.current ? "up" : "down";
    setFlash(direction);
    prevPriceRef.current = price;
    const t = setTimeout(() => setFlash(null), 300);
    return () => clearTimeout(t);
  }, [price]);

  // Daily high/low from candle data
  const todayCandles = candleData.slice(-390); // ~6.5h of 1m candles
  const high = todayCandles.reduce((m, c) => Math.max(m, c.high), 0);
  const low = todayCandles.reduce((m, c) => Math.min(m, c.low), Infinity);
  const vol = todayCandles.reduce((m, c) => m + c.volume, 0);

  return (
    <div className="flex items-center px-3 py-1.5 border-b border-[#252930] bg-[#0d0f12] h-12 shrink-0 gap-6">
      {/* Symbol */}
      <div className="flex items-center gap-2">
        <span className="text-[#e2e8f0] font-semibold text-sm tracking-wide">{activeSymbol}</span>
        <span className="text-[#64748b] text-[10px] uppercase tracking-wide">{meta.exchange ?? "NASDAQ"}</span>
      </div>

      {/* Live price — flashes on update */}
      <div
        className={`font-mono text-xl font-semibold transition-colors duration-150 ${
          flash === "up"
            ? "text-[#22c55e]"
            : flash === "down"
            ? "text-[#ef4444]"
            : "text-[#e2e8f0]"
        }`}
      >
        {price > 0 ? formatPrice(price) : "—"}
      </div>

      {/* Change */}
      <div className={`flex items-center gap-1 font-mono text-sm ${isUp ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
        <span>{isUp ? "▲" : "▼"}</span>
        <span>{change >= 0 ? "+" : ""}{formatPrice(Math.abs(change))}</span>
        <span className="text-[11px]">({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)</span>
      </div>

      <div className="h-4 w-px bg-[#252930]" />

      {/* OHLC stats */}
      <div className="flex items-center gap-4">
        <Stat label="OPEN" value={firstCandle ? formatPrice(firstCandle.open) : "—"} />
        <Stat label="HIGH" value={high > 0 ? formatPrice(high) : "—"} color="#22c55e" />
        <Stat label="LOW" value={low < Infinity ? formatPrice(low) : "—"} color="#ef4444" />
        <Stat label="VOL" value={vol > 0 ? formatVolume(vol) : "—"} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wider text-[#64748b]">{label}</span>
      <span className={`font-mono text-xs ${color ? `text-[${color}]` : "text-[#94a3b8]"}`} style={color ? { color } : {}}>
        {value}
      </span>
    </div>
  );
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}
