import type { TradeRecord } from "@/lib/types";

let tradeCounter = 10000;

export function generateTrade(symbol: string, price: number): TradeRecord {
  tradeCounter++;
  const side = Math.random() > 0.5 ? "BUY" : "SELL";
  const quantity = Math.floor(Math.random() * 900 + 100);

  return {
    tradeId: `TRD${tradeCounter}`,
    symbol,
    price: parseFloat(price.toFixed(2)),
    quantity,
    timestamp: Date.now(),
    side,
    isMaker: Math.random() > 0.5,
  };
}

export function generateInitialTrades(symbol: string, price: number, count: number = 30): TradeRecord[] {
  const trades: TradeRecord[] = [];
  let p = price;
  for (let i = count; i >= 0; i--) {
    p = parseFloat((p * (1 + (Math.random() - 0.5) * 0.0008)).toFixed(2));
    trades.push({
      tradeId: `TRD${tradeCounter - i}`,
      symbol,
      price: p,
      quantity: Math.floor(Math.random() * 900 + 100),
      timestamp: Date.now() - i * 800,
      side: Math.random() > 0.5 ? "BUY" : "SELL",
      isMaker: Math.random() > 0.5,
    });
  }
  return trades;
}
