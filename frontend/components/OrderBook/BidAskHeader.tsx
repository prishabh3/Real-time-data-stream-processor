

interface BidAskHeaderProps {
  bestBid: number;
  bestAsk: number;
  spread: number;
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function calcMidPrice(bestBid: number, bestAsk: number): number {
  return (bestBid + bestAsk) / 2;
}

function calcSpreadBps(spread: number, midPrice: number): number {
  if (midPrice === 0) return 0;
  return (spread / midPrice) * 10000;
}

export default function BidAskHeader({
  bestBid,
  bestAsk,
  spread,
}: BidAskHeaderProps) {
  const midPrice = calcMidPrice(bestBid, bestAsk);
  const spreadBps = calcSpreadBps(spread, midPrice);

  return (
    <div className="grid grid-cols-3 gap-px bg-[#252930] border-b border-[#252930]">
      {/* Best Bid */}
      <div className="bg-[#111318] px-3 py-2 flex flex-col gap-0.5">
        <span
          className="text-[#64748b] uppercase tracking-wider"
          style={{ fontSize: "10px" }}
        >
          Best Bid
        </span>
        <span className="font-mono text-[#22c55e] text-sm font-semibold leading-tight tabular-nums">
          {formatPrice(bestBid)}
        </span>
      </div>

      {/* Spread / Mid */}
      <div className="bg-[#111318] px-3 py-2 flex flex-col gap-0.5 border-x border-[#252930]">
        <span
          className="text-[#64748b] uppercase tracking-wider"
          style={{ fontSize: "10px" }}
        >
          Spread / Mid
        </span>
        <span className="font-mono text-[#94a3b8] text-sm leading-tight tabular-nums">
          {formatPrice(spread)}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="text-[#64748b] uppercase tracking-wider"
            style={{ fontSize: "9px" }}
          >
            Mid:
          </span>
          <span
            className="font-mono text-[#e2e8f0] tabular-nums"
            style={{ fontSize: "11px" }}
          >
            {formatPrice(midPrice)}
          </span>
          <span
            className="font-mono text-[#f59e0b] ml-auto tabular-nums"
            style={{ fontSize: "9px" }}
          >
            {spreadBps.toFixed(1)}bps
          </span>
        </div>
      </div>

      {/* Best Ask */}
      <div className="bg-[#111318] px-3 py-2 flex flex-col gap-0.5 items-end">
        <span
          className="text-[#64748b] uppercase tracking-wider"
          style={{ fontSize: "10px" }}
        >
          Best Ask
        </span>
        <span className="font-mono text-[#ef4444] text-sm font-semibold leading-tight tabular-nums">
          {formatPrice(bestAsk)}
        </span>
      </div>
    </div>
  );
}
