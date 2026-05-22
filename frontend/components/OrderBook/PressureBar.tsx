"use client";

import { useOrderBookStore } from "@/store/orderbookStore";
import { useMarketStore } from "@/store/marketStore";
import type { OrderLevel } from "@/lib/types";

const LEVELS = 10;

function formatQty(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

export default function PressureBar() {
  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const snapshots = useOrderBookStore((s) => s.snapshots);
  const snapshot = snapshots[activeSymbol];

  const bids: OrderLevel[] = snapshot?.bids?.slice(0, LEVELS) ?? [];
  const asks: OrderLevel[] = snapshot?.asks?.slice(0, LEVELS) ?? [];

  const totalBidQty = bids.reduce((acc, b) => acc + b.quantity, 0);
  const totalAskQty = asks.reduce((acc, a) => acc + a.quantity, 0);
  const grandTotal = totalBidQty + totalAskQty;

  const buyPressure = grandTotal > 0 ? (totalBidQty / grandTotal) * 100 : 50;
  const sellPressure = 100 - buyPressure;

  const isImbalanced = buyPressure > 65 || sellPressure > 65;
  const isBuyImbalance = buyPressure > 65;

  return (
    <div className="px-3 py-2 border-t border-[#252930] bg-[#0d0f12]">
      {/* Imbalance warning badge */}
      {isImbalanced && (
        <div className="flex justify-center mb-1.5">
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded border"
            style={{
              borderColor: isBuyImbalance
                ? "rgba(34,197,94,0.4)"
                : "rgba(239,68,68,0.4)",
              backgroundColor: isBuyImbalance
                ? "rgba(34,197,94,0.08)"
                : "rgba(239,68,68,0.08)",
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                backgroundColor: isBuyImbalance ? "#22c55e" : "#ef4444",
              }}
            />
            <span
              className="uppercase tracking-wider font-semibold"
              style={{
                fontSize: "9px",
                color: isBuyImbalance ? "#22c55e" : "#ef4444",
              }}
            >
              {isBuyImbalance ? "Buy" : "Sell"} Imbalance
            </span>
          </div>
        </div>
      )}

      {/* Pressure bar */}
      <div className="relative h-3 rounded overflow-hidden bg-[#1a1d23] flex">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${buyPressure}%`,
            backgroundColor: "#22c55e",
            opacity: 0.85,
          }}
        />
        <div
          className="h-full flex-1 transition-all duration-500 ease-out"
          style={{
            backgroundColor: "#ef4444",
            opacity: 0.85,
          }}
        />
        {/* Center tick mark */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#252930] z-10" />
      </div>

      {/* Percentage labels */}
      <div className="flex justify-between mt-1">
        <span
          className="font-mono text-[#22c55e] tabular-nums font-semibold"
          style={{ fontSize: "11px" }}
        >
          {buyPressure.toFixed(1)}%
        </span>
        <span
          className="font-mono text-[#ef4444] tabular-nums font-semibold"
          style={{ fontSize: "11px" }}
        >
          {sellPressure.toFixed(1)}%
        </span>
      </div>

      {/* Side labels and quantities */}
      <div className="flex justify-between mt-0.5">
        <div className="flex flex-col">
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "9px" }}
          >
            Buy Pressure
          </span>
          <span
            className="font-mono text-[#94a3b8] tabular-nums"
            style={{ fontSize: "9px" }}
          >
            {formatQty(totalBidQty)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "9px" }}
          >
            Sell Pressure
          </span>
          <span
            className="font-mono text-[#94a3b8] tabular-nums"
            style={{ fontSize: "9px" }}
          >
            {formatQty(totalAskQty)}
          </span>
        </div>
      </div>
    </div>
  );
}
