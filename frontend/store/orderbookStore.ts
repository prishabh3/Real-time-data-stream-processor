import { create } from "zustand";
import type { OrderBookSnapshot, TradeRecord } from "@/lib/types";

interface OrderBookState {
  snapshots: Record<string, OrderBookSnapshot>;
  setSnapshot: (symbol: string, snap: OrderBookSnapshot) => void;

  trades: Record<string, TradeRecord[]>;
  appendTrade: (symbol: string, trade: TradeRecord) => void;
  setInitialTrades: (symbol: string, trades: TradeRecord[]) => void;
}

export const useOrderBookStore = create<OrderBookState>((set) => ({
  snapshots: {},
  setSnapshot: (symbol, snap) =>
    set((s) => ({ snapshots: { ...s.snapshots, [symbol]: snap } })),

  trades: {},
  appendTrade: (symbol, trade) =>
    set((s) => {
      const existing = s.trades[symbol] ?? [];
      return {
        trades: {
          ...s.trades,
          [symbol]: [trade, ...existing].slice(0, 100),
        },
      };
    }),
  setInitialTrades: (symbol, trades) =>
    set((s) => ({ trades: { ...s.trades, [symbol]: trades } })),
}));
