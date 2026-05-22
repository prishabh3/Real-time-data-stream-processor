"use client";

import { useOrderBookStore } from "@/store/orderbookStore";
import { useMarketStore } from "@/store/marketStore";
import type { OrderLevel } from "@/lib/types";

const LEVELS = 10;

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

interface DepthRowProps {
  price: number;
  quantity: number;
  barPercent: number;
  side: "bid" | "ask";
  cumPercent: number;
}

function DepthRow({ price, quantity, barPercent, side, cumPercent }: DepthRowProps) {
  const isBid = side === "bid";

  return (
    <div className="relative flex items-center py-0.5 px-2 group hover:bg-[#1a1d23] transition-colors duration-100">
      {/* Depth bar */}
      <div
        className="absolute inset-y-0 pointer-events-none"
        style={{
          [isBid ? "right" : "left"]: 0,
          width: `${barPercent}%`,
          backgroundColor: isBid
            ? "rgba(34,197,94,0.08)"
            : "rgba(239,68,68,0.08)",
        }}
      />
      {/* Cumulative bar (thinner, more transparent) */}
      <div
        className="absolute inset-y-0 pointer-events-none"
        style={{
          [isBid ? "right" : "left"]: 0,
          width: `${cumPercent}%`,
          backgroundColor: isBid
            ? "rgba(34,197,94,0.04)"
            : "rgba(239,68,68,0.04)",
        }}
      />

      {isBid ? (
        <>
          <span
            className="font-mono text-[#22c55e] tabular-nums z-10 flex-1"
            style={{ fontSize: "11px" }}
          >
            {formatPrice(price)}
          </span>
          <span
            className="font-mono text-[#e2e8f0] tabular-nums z-10 text-right"
            style={{ fontSize: "11px" }}
          >
            {formatQty(quantity)}
          </span>
        </>
      ) : (
        <>
          <span
            className="font-mono text-[#e2e8f0] tabular-nums z-10 flex-1"
            style={{ fontSize: "11px" }}
          >
            {formatQty(quantity)}
          </span>
          <span
            className="font-mono text-[#ef4444] tabular-nums z-10 text-right"
            style={{ fontSize: "11px" }}
          >
            {formatPrice(price)}
          </span>
        </>
      )}
    </div>
  );
}

export default function OrderBookDepth() {
  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const snapshots = useOrderBookStore((s) => s.snapshots);
  const snapshot = snapshots[activeSymbol];

  const rawBids: OrderLevel[] = snapshot?.bids?.slice(0, LEVELS) ?? [];
  const rawAsks: OrderLevel[] = snapshot?.asks?.slice(0, LEVELS) ?? [];

  // Pad to LEVELS rows with zeroes for stable layout
  const bids: OrderLevel[] = [
    ...rawBids,
    ...Array.from({ length: Math.max(0, LEVELS - rawBids.length) }, () => ({
      price: 0,
      quantity: 0,
    })),
  ];
  const asks: OrderLevel[] = [
    ...rawAsks,
    ...Array.from({ length: Math.max(0, LEVELS - rawAsks.length) }, () => ({
      price: 0,
      quantity: 0,
    })),
  ];

  const maxBidQty = Math.max(...bids.map((b) => b.quantity), 1);
  const maxAskQty = Math.max(...asks.map((a) => a.quantity), 1);

  // Cumulative quantities for cumulative bar
  let bidCum = 0;
  const totalBidQty = bids.reduce((acc, b) => acc + b.quantity, 0);
  let askCum = 0;
  const totalAskQty = asks.reduce((acc, a) => acc + a.quantity, 0);
  const grandTotal = totalBidQty + totalAskQty;

  return (
    <div className="flex flex-col flex-1 min-h-0 select-none">
      {/* Column headers */}
      <div className="flex border-b border-[#252930] bg-[#0d0f12]">
        <div className="flex-1 flex items-center justify-between px-2 py-1 border-r border-[#252930]">
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "10px" }}
          >
            Price
          </span>
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "10px" }}
          >
            Qty (Bid)
          </span>
        </div>
        <div className="flex-1 flex items-center justify-between px-2 py-1">
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "10px" }}
          >
            Qty (Ask)
          </span>
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "10px" }}
          >
            Price
          </span>
        </div>
      </div>

      {/* Depth rows */}
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: LEVELS }).map((_, i) => {
          const bid = bids[i];
          const ask = asks[i];

          bidCum += bid.quantity;
          askCum += ask.quantity;

          const bidBarPct =
            bid.quantity > 0 ? (bid.quantity / maxBidQty) * 100 : 0;
          const askBarPct =
            ask.quantity > 0 ? (ask.quantity / maxAskQty) * 100 : 0;
          const bidCumPct =
            totalBidQty > 0 ? (bidCum / totalBidQty) * 100 : 0;
          const askCumPct =
            totalAskQty > 0 ? (askCum / totalAskQty) * 100 : 0;

          return (
            <div key={i} className="flex border-b border-[#1a1d23]">
              {/* Bid side */}
              <div className="flex-1 border-r border-[#252930]">
                {bid.price > 0 ? (
                  <DepthRow
                    price={bid.price}
                    quantity={bid.quantity}
                    barPercent={bidBarPct}
                    cumPercent={bidCumPct}
                    side="bid"
                  />
                ) : (
                  <div className="py-0.5 px-2 h-[20px]" />
                )}
              </div>
              {/* Ask side */}
              <div className="flex-1">
                {ask.price > 0 ? (
                  <DepthRow
                    price={ask.price}
                    quantity={ask.quantity}
                    barPercent={askBarPct}
                    cumPercent={askCumPct}
                    side="ask"
                  />
                ) : (
                  <div className="py-0.5 px-2 h-[20px]" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals footer */}
      <div className="flex border-t border-[#252930] bg-[#0d0f12]">
        <div className="flex-1 flex items-center justify-between px-2 py-1 border-r border-[#252930]">
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "9px" }}
          >
            Total Bid
          </span>
          <span
            className="font-mono text-[#22c55e] tabular-nums"
            style={{ fontSize: "10px" }}
          >
            {formatQty(totalBidQty)}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-between px-2 py-1">
          <span
            className="font-mono text-[#ef4444] tabular-nums"
            style={{ fontSize: "10px" }}
          >
            {formatQty(totalAskQty)}
          </span>
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "9px" }}
          >
            Total Ask
          </span>
        </div>
      </div>

      {/* Grand total ratio bar */}
      {grandTotal > 0 && (
        <div className="flex h-1">
          <div
            className="bg-[#22c55e] opacity-40 transition-all duration-300"
            style={{ width: `${(totalBidQty / grandTotal) * 100}%` }}
          />
          <div
            className="bg-[#ef4444] opacity-40 transition-all duration-300 flex-1"
          />
        </div>
      )}
    </div>
  );
}
