import { create } from "zustand";
import type {
  OHLCVCandle,
  SymbolInfo,
  Timeframe,
  DataPoint,
  AnalyticsSnapshot,
} from "@/lib/types";

interface MarketState {
  // Watchlist symbols
  symbols: SymbolInfo[];
  setSymbols: (s: SymbolInfo[]) => void;
  updateSymbol: (symbol: string, patch: Partial<SymbolInfo>) => void;

  // Selected symbol
  activeSymbol: string;
  setActiveSymbol: (s: string) => void;

  // Timeframe
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;

  // Candle history keyed by symbol+timeframe
  candles: Record<string, OHLCVCandle[]>;
  setCandles: (symbol: string, timeframe: string, candles: OHLCVCandle[]) => void;
  appendCandle: (symbol: string, timeframe: string, candle: OHLCVCandle) => void;

  // Last tick price per symbol
  lastPrices: Record<string, number>;
  setLastPrice: (symbol: string, price: number) => void;

  // Analytics per symbol
  analytics: Record<string, AnalyticsSnapshot>;
  setAnalytics: (symbol: string, data: Partial<AnalyticsSnapshot>) => void;

  // Indicator visibility
  showSMA: boolean;
  showEMA: boolean;
  showBollinger: boolean;
  showVWAP: boolean;
  toggleIndicator: (indicator: "showSMA" | "showEMA" | "showBollinger" | "showVWAP") => void;

  // Price history for sparklines (per symbol, 60-point rolling)
  priceHistory: Record<string, DataPoint[]>;
  appendPricePoint: (symbol: string, point: DataPoint) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  symbols: [],
  setSymbols: (symbols) => set({ symbols }),
  updateSymbol: (symbol, patch) =>
    set((s) => ({
      symbols: s.symbols.map((sym) =>
        sym.symbol === symbol ? { ...sym, ...patch } : sym
      ),
    })),

  activeSymbol: "AAPL",
  setActiveSymbol: (activeSymbol) => set({ activeSymbol }),

  timeframe: "1m",
  setTimeframe: (timeframe) => set({ timeframe }),

  candles: {},
  setCandles: (symbol, timeframe, candles) =>
    set((s) => ({ candles: { ...s.candles, [`${symbol}:${timeframe}`]: candles } })),
  appendCandle: (symbol, timeframe, candle) =>
    set((s) => {
      const key = `${symbol}:${timeframe}`;
      const existing = s.candles[key] ?? [];
      const last = existing[existing.length - 1];
      let updated: OHLCVCandle[];
      if (last && last.time === candle.time) {
        updated = [...existing.slice(0, -1), candle];
      } else {
        updated = [...existing, candle].slice(-500); // keep last 500
      }
      return { candles: { ...s.candles, [key]: updated } };
    }),

  lastPrices: {},
  setLastPrice: (symbol, price) =>
    set((s) => ({ lastPrices: { ...s.lastPrices, [symbol]: price } })),

  analytics: {},
  setAnalytics: (symbol, data) =>
    set((s) => ({
      analytics: {
        ...s.analytics,
        [symbol]: { ...s.analytics[symbol], ...data, symbol } as AnalyticsSnapshot,
      },
    })),

  showSMA: true,
  showEMA: false,
  showBollinger: false,
  showVWAP: true,
  toggleIndicator: (indicator) =>
    set((s) => ({ [indicator]: !s[indicator] })),

  priceHistory: {},
  appendPricePoint: (symbol, point) =>
    set((s) => {
      const existing = s.priceHistory[symbol] ?? [];
      const updated = [...existing, point].slice(-120);
      return { priceHistory: { ...s.priceHistory, [symbol]: updated } };
    }),
}));
