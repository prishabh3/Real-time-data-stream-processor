"use client";

import { useEffect, useRef, useState } from "react";
import { useOrderBookStore } from "@/store/orderbookStore";
import { useMarketStore } from "@/store/marketStore";
import type { TradeRecord } from "@/lib/types";

const MAX_VISIBLE = 50;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatQty(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

interface TradeRowProps {
  trade: TradeRecord;
  isNew: boolean;
}

function TradeRow({ trade, isNew }: TradeRowProps) {
  const isBuy = trade.side === "BUY";

  return (
    <div
      className="flex items-center gap-2 px-2 py-0.5 border-b border-[#1a1d23] transition-colors duration-150"
      style={{
        backgroundColor: isNew
          ? isBuy
            ? "rgba(34,197,94,0.10)"
            : "rgba(239,68,68,0.10)"
          : "transparent",
      }}
    >
      {/* Timestamp */}
      <span
        className="font-mono text-[#64748b] tabular-nums shrink-0"
        style={{ fontSize: "10px" }}
      >
        {formatTime(trade.timestamp)}
      </span>

      {/* Price */}
      <span
        className={`font-mono tabular-nums shrink-0 font-medium ${
          isBuy ? "text-[#22c55e]" : "text-[#ef4444]"
        }`}
        style={{ fontSize: "11px" }}
      >
        {formatPrice(trade.price)}
      </span>

      {/* Quantity */}
      <span
        className="font-mono text-[#e2e8f0] tabular-nums flex-1 text-right"
        style={{ fontSize: "11px" }}
      >
        {formatQty(trade.quantity)}
      </span>

      {/* Side badge */}
      <span
        className="shrink-0 font-semibold uppercase tracking-wider px-1 rounded"
        style={{
          fontSize: "9px",
          color: isBuy ? "#22c55e" : "#ef4444",
          backgroundColor: isBuy
            ? "rgba(34,197,94,0.12)"
            : "rgba(239,68,68,0.12)",
        }}
      >
        {trade.side}
      </span>

      {/* Maker indicator */}
      {trade.isMaker && (
        <span
          className="text-[#64748b] shrink-0"
          style={{ fontSize: "9px" }}
          title="Maker order"
        >
          M
        </span>
      )}
    </div>
  );
}

export default function TradesTape() {
  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const allTrades = useOrderBookStore((s) => s.trades);
  const trades: TradeRecord[] = (allTrades[activeSymbol] ?? []).slice(
    0,
    MAX_VISIBLE
  );

  // Track the latest trade ID so we can flash the newest row
  const [newTradeId, setNewTradeId] = useState<string | null>(null);
  const prevTopId = useRef<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const topTrade = trades[0];
    if (!topTrade) return;
    if (topTrade.tradeId !== prevTopId.current) {
      prevTopId.current = topTrade.tradeId;
      setNewTradeId(topTrade.tradeId);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
        setNewTradeId(null);
      }, 350);
    }
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span
          className="text-[#64748b] uppercase tracking-wider"
          style={{ fontSize: "10px" }}
        >
          Awaiting trades…
        </span>
      </div>
    );
  }

  return (
    <div
      className="overflow-y-auto flex-1"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
    >
      {trades.map((trade) => (
        <TradeRow
          key={trade.tradeId}
          trade={trade}
          isNew={trade.tradeId === newTradeId}
        />
      ))}
    </div>
  );
}
