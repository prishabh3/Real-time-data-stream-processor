import type { OrderBookSnapshot, OrderLevel } from "@/lib/types";
import { SYMBOL_META } from "./marketSimulator";

// Maintain order book state per symbol
interface BookState {
  bids: Map<number, number>; // price → qty
  asks: Map<number, number>;
  lastMid: number;
}

const bookStates = new Map<string, BookState>();

function getOrCreateBookState(symbol: string): BookState {
  if (!bookStates.has(symbol)) {
    const meta = SYMBOL_META[symbol] ?? { basePrice: 100, volatility: 0.01 };
    const mid = meta.basePrice;
    const spread = mid * 0.0002; // ~2bps spread
    const bids = new Map<number, number>();
    const asks = new Map<number, number>();

    // Seed 10 levels each side
    for (let i = 0; i < 12; i++) {
      const bidPrice = parseFloat((mid - spread / 2 - i * mid * 0.0005).toFixed(2));
      const askPrice = parseFloat((mid + spread / 2 + i * mid * 0.0005).toFixed(2));
      const bidQty = Math.floor(Math.random() * 8000 + 500);
      const askQty = Math.floor(Math.random() * 8000 + 500);
      bids.set(bidPrice, bidQty);
      asks.set(askPrice, askQty);
    }

    bookStates.set(symbol, { bids, asks, lastMid: mid });
  }
  return bookStates.get(symbol)!;
}

function jitter(map: Map<number, number>, basePrice: number, isBid: boolean): void {
  // Remove a random level and add a new one
  const keys = Array.from(map.keys());
  if (keys.length > 2) {
    const removeIdx = Math.floor(Math.random() * 3);
    map.delete(keys[removeIdx]);
  }

  // Update existing quantities
  for (const [price, qty] of map.entries()) {
    const newQty = Math.max(100, qty + Math.floor((Math.random() - 0.5) * 1000));
    map.set(price, newQty);
  }
}

export function generateOrderBook(symbol: string, currentPrice: number): OrderBookSnapshot {
  const state = getOrCreateBookState(symbol);
  const spread = currentPrice * 0.0002;

  // Re-center around current price
  const midDrift = currentPrice - state.lastMid;
  if (Math.abs(midDrift) > currentPrice * 0.001) {
    // Rebuild book around new price
    const newBids = new Map<number, number>();
    const newAsks = new Map<number, number>();
    for (let i = 0; i < 12; i++) {
      const bidPrice = parseFloat((currentPrice - spread / 2 - i * currentPrice * 0.0005).toFixed(2));
      const askPrice = parseFloat((currentPrice + spread / 2 + i * currentPrice * 0.0005).toFixed(2));
      newBids.set(bidPrice, Math.floor(Math.random() * 8000 + 500));
      newAsks.set(askPrice, Math.floor(Math.random() * 8000 + 500));
    }
    state.bids = newBids;
    state.asks = newAsks;
    state.lastMid = currentPrice;
  } else {
    jitter(state.bids, currentPrice, true);
    jitter(state.asks, currentPrice, false);
    state.lastMid = currentPrice;
  }

  // Sort and build output
  const sortedBids: OrderLevel[] = Array.from(state.bids.entries())
    .sort((a, b) => b[0] - a[0])
    .slice(0, 10)
    .map(([price, quantity]) => ({ price, quantity }));

  const sortedAsks: OrderLevel[] = Array.from(state.asks.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 10)
    .map(([price, quantity]) => ({ price, quantity }));

  const bestBid = sortedBids[0]?.price ?? currentPrice - spread / 2;
  const bestAsk = sortedAsks[0]?.price ?? currentPrice + spread / 2;

  return {
    symbol,
    bids: sortedBids,
    asks: sortedAsks,
    bestBid: parseFloat(bestBid.toFixed(2)),
    bestAsk: parseFloat(bestAsk.toFixed(2)),
    spread: parseFloat((bestAsk - bestBid).toFixed(2)),
    timestamp: Date.now(),
  };
}
