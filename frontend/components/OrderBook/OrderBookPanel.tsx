"use client";

import { useMarketStore } from "@/store/marketStore";
import { useOrderBookStore } from "@/store/orderbookStore";
import BidAskHeader from "./BidAskHeader";
import OrderBookDepth from "./OrderBookDepth";
import TradesTape from "./TradesTape";
import PressureBar from "./PressureBar";

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return "--:--:--";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function OrderBookPanel() {
  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const snapshots = useOrderBookStore((s) => s.snapshots);
  const snapshot = snapshots[activeSymbol];

  const bestBid = snapshot?.bestBid ?? 0;
  const bestAsk = snapshot?.bestAsk ?? 0;
  const spread = snapshot?.spread ?? 0;
  const timestamp = snapshot?.timestamp;

  return (
    <div
      className="flex flex-col h-full w-full bg-[#111318] border-l border-[#252930]"
    >
      {/* ── Panel Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#252930] bg-[#0d0f12] shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[#64748b] uppercase tracking-wider font-semibold"
            style={{ fontSize: "10px", letterSpacing: "0.1em" }}
          >
            Order Book
          </span>
          {/* Symbol badge */}
          <span
            className="px-1.5 py-0.5 rounded bg-[#1a1d23] border border-[#252930] text-[#3b82f6] font-mono font-semibold"
            style={{ fontSize: "10px" }}
          >
            {activeSymbol}
          </span>
        </div>
        {/* Live indicator + timestamp */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"
          />
          <span
            className="font-mono text-[#64748b] tabular-nums"
            style={{ fontSize: "10px" }}
          >
            {formatTimestamp(timestamp)}
          </span>
        </div>
      </div>

      {/* ── Bid/Ask Header ───────────────────────────────────────── */}
      <div className="shrink-0">
        <BidAskHeader
          bestBid={bestBid}
          bestAsk={bestAsk}
          spread={spread}
        />
      </div>

      {/* ── Order Book Depth ─────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <OrderBookDepth />
      </div>

      {/* ── Recent Trades Divider ────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1 border-t border-b border-[#252930] bg-[#0d0f12] shrink-0">
        <span
          className="text-[#64748b] uppercase tracking-wider"
          style={{ fontSize: "9px", letterSpacing: "0.12em" }}
        >
          Recent Trades
        </span>
        <div className="flex-1 h-px bg-[#252930]" />
        <span
          className="text-[#64748b] uppercase tracking-wider"
          style={{ fontSize: "9px" }}
        >
          Live
        </span>
        <span className="inline-block w-1 h-1 rounded-full bg-[#f59e0b] animate-pulse" />
      </div>

      {/* ── Trades Tape ─────────────────────────────────────────── */}
      <div className="flex flex-col bg-[#111318]" style={{ height: "180px" }}>
        {/* Column header */}
        <div className="flex items-center gap-2 px-2 py-0.5 border-b border-[#252930] shrink-0">
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "9px", width: "76px" }}
          >
            Time
          </span>
          <span
            className="text-[#64748b] uppercase tracking-wider flex-1"
            style={{ fontSize: "9px" }}
          >
            Price
          </span>
          <span
            className="text-[#64748b] uppercase tracking-wider text-right"
            style={{ fontSize: "9px" }}
          >
            Qty
          </span>
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "9px", width: "28px" }}
          >
            Side
          </span>
        </div>
        <TradesTape />
      </div>

      {/* ── Pressure Bar ─────────────────────────────────────────── */}
      <div className="shrink-0">
        <PressureBar />
      </div>
    </div>
  );
}
