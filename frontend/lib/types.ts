// ─── Types mirroring the C++ backend structs ───────────────────────────────
// Matches: MarketDataFeed.h, OrderBook.h, Analytics.h, StreamProcessor.h

// TickData — from MarketDataFeed.h
export interface TickData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number; // epoch ms
  source: "ALPHA_VANTAGE" | "YAHOO" | "SIMULATED";
}

// OHLCV candle (aggregated from ticks for chart rendering)
export interface OHLCVCandle {
  time: number; // epoch seconds (LightweightCharts format)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// OrderBook — from OrderBook.h
export interface OrderLevel {
  price: number;
  quantity: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: OrderLevel[]; // sorted descending by price
  asks: OrderLevel[]; // sorted ascending by price
  bestBid: number;
  bestAsk: number;
  spread: number;
  timestamp: number;
}

// Analytics — from Analytics.h
export interface RSIResult {
  value: number; // 0–100
  isOverbought: boolean; // value > 70
  isOversold: boolean; // value < 30
}

export interface MACDResult {
  macdLine: number; // EMA(12) − EMA(26)
  signalLine: number; // EMA(9) of macdLine
  histogram: number; // macdLine − signalLine
}

export interface BollingerBands {
  upper: number;
  middle: number; // SMA(period)
  lower: number;
  bandwidth: number; // (upper − lower) / middle
}

export interface AnalyticsSnapshot {
  symbol: string;
  sma20: number;
  sma50: number;
  sma200: number;
  ema20: number;
  vwap: number;
  volatility: number;
  rsi: RSIResult;
  macd: MACDResult;
  bollinger: BollingerBands;
  timestamp: number;
}

// PerformanceMetrics — from StreamProcessor.h
export interface PerformanceMetrics {
  totalTicksProcessed: number;
  averageLatencyMs: number;
  peakLatencyMs: number;
  throughputPerSecond: number;
  startTime: number;
  // Extended fields for frontend display
  queueUtilization: number; // 0–1
  threadCount: number;
  cpuPercent: number;
  memMb: number;
  activeFeeds: number;
}

// Trade record (from MatchingEngine)
export interface TradeRecord {
  tradeId: string;
  symbol: string;
  price: number;
  quantity: number;
  timestamp: number;
  side: "BUY" | "SELL";
  isMaker: boolean;
}

// Connection state
export type ConnectionState =
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "DISCONNECTED";

// Symbol definition
export interface SymbolInfo {
  symbol: string;
  name: string;
  exchange: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
}

// Alert (from Analytics.h PriceAlert)
export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  isAbove: boolean;
  triggered: boolean;
  triggeredAt?: number;
  currentPrice?: number;
}

// Timeframe for chart
export type Timeframe = "1m" | "5m" | "15m" | "1H" | "4H" | "1D";

// Historical data point for sparklines
export interface DataPoint {
  timestamp: number;
  value: number;
}

// MACD history for chart
export interface MACDDataPoint {
  time: number;
  macdLine: number;
  signalLine: number;
  histogram: number;
}

// RSI history for chart
export interface RSIDataPoint {
  time: number;
  value: number;
}

// Bollinger history for chart
export interface BollingerDataPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}
