import type { TickData, OHLCVCandle, SymbolInfo, DataPoint } from "@/lib/types";

// Symbols from config.ini
export const SYMBOLS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "JPM", "BAC"] as const;

export const SYMBOL_META: Record<string, { name: string; exchange: string; basePrice: number; volatility: number }> = {
  AAPL:  { name: "Apple Inc.",          exchange: "NASDAQ", basePrice: 189.84, volatility: 0.015 },
  GOOGL: { name: "Alphabet Inc.",       exchange: "NASDAQ", basePrice: 174.12, volatility: 0.018 },
  MSFT:  { name: "Microsoft Corp.",     exchange: "NASDAQ", basePrice: 415.32, volatility: 0.014 },
  AMZN:  { name: "Amazon.com Inc.",     exchange: "NASDAQ", basePrice: 198.56, volatility: 0.020 },
  TSLA:  { name: "Tesla Inc.",          exchange: "NASDAQ", basePrice: 248.42, volatility: 0.035 },
  NVDA:  { name: "NVIDIA Corp.",        exchange: "NASDAQ", basePrice: 875.39, volatility: 0.028 },
  JPM:   { name: "JPMorgan Chase",      exchange: "NYSE",   basePrice: 198.21, volatility: 0.012 },
  BAC:   { name: "Bank of America",     exchange: "NYSE",   basePrice: 40.87,  volatility: 0.013 },
};

// ─── Price simulation state ──────────────────────────────────────────────────
class PriceState {
  price: number;
  trend: number; // mean-reverting drift
  readonly basePrice: number;
  readonly volatility: number;

  constructor(basePrice: number, volatility: number) {
    this.price = basePrice;
    this.basePrice = basePrice;
    this.volatility = volatility;
    this.trend = 0;
  }

  nextPrice(): number {
    // Ornstein–Uhlenbeck mean reversion + Brownian motion
    const meanReversionSpeed = 0.03;
    const shock = (Math.random() - 0.5) * 2 * this.volatility * this.price;
    const reversion = meanReversionSpeed * (this.basePrice - this.price);
    const trendDecay = 0.98;

    this.trend = this.trend * trendDecay + shock * 0.1;
    this.price = Math.max(this.price + reversion + shock + this.trend, 0.01);
    return parseFloat(this.price.toFixed(2));
  }
}

const priceStates = new Map<string, PriceState>();

SYMBOLS.forEach((sym) => {
  const meta = SYMBOL_META[sym];
  priceStates.set(sym, new PriceState(meta.basePrice, meta.volatility));
});

// ─── Tick generator ──────────────────────────────────────────────────────────
export function generateTick(symbol: string): TickData {
  const state = priceStates.get(symbol)!;
  const price = state.nextPrice();
  const volume = Math.floor(Math.random() * 9500 + 500);

  return {
    symbol,
    price,
    volume,
    timestamp: Date.now(),
    source: "SIMULATED",
  };
}

// ─── Candle aggregation ──────────────────────────────────────────────────────
interface CandleBuilder {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const candleBuilders = new Map<string, Map<string, CandleBuilder>>();

export function getTimeframeBucketSeconds(tf: string): number {
  const map: Record<string, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1H": 3600,
    "4H": 14400,
    "1D": 86400,
  };
  return map[tf] ?? 60;
}

export function aggregateTick(tick: TickData, timeframe: string): OHLCVCandle | null {
  const bucketSecs = getTimeframeBucketSeconds(timeframe);
  const bucketTime = Math.floor(tick.timestamp / 1000 / bucketSecs) * bucketSecs;

  if (!candleBuilders.has(tick.symbol)) {
    candleBuilders.set(tick.symbol, new Map());
  }
  const byTF = candleBuilders.get(tick.symbol)!;
  const key = `${timeframe}:${bucketTime}`;

  if (!byTF.has(key)) {
    byTF.set(key, {
      time: bucketTime,
      open: tick.price,
      high: tick.price,
      low: tick.price,
      close: tick.price,
      volume: tick.volume,
    });
  } else {
    const c = byTF.get(key)!;
    c.high = Math.max(c.high, tick.price);
    c.low = Math.min(c.low, tick.price);
    c.close = tick.price;
    c.volume += tick.volume;
  }

  return byTF.get(key)!;
}

// ─── Historical candle seed ──────────────────────────────────────────────────
export function generateHistoricalCandles(symbol: string, timeframe: string, count: number = 300): OHLCVCandle[] {
  const meta = SYMBOL_META[symbol];
  if (!meta) return [];

  const bucketSecs = getTimeframeBucketSeconds(timeframe);
  const now = Math.floor(Date.now() / 1000 / bucketSecs) * bucketSecs;
  const state = new PriceState(meta.basePrice, meta.volatility * 0.8);
  const candles: OHLCVCandle[] = [];

  // Walk backward then forward
  const startTime = now - count * bucketSecs;
  for (let i = 0; i < count; i++) {
    const t = startTime + i * bucketSecs;
    const o = state.price;
    const c = state.nextPrice();
    const h = Math.max(o, c) * (1 + Math.random() * 0.003);
    const l = Math.min(o, c) * (1 - Math.random() * 0.003);
    const v = Math.floor(Math.random() * 500000 + 50000);

    candles.push({
      time: t,
      open: parseFloat(o.toFixed(2)),
      high: parseFloat(h.toFixed(2)),
      low: parseFloat(l.toFixed(2)),
      close: parseFloat(c.toFixed(2)),
      volume: v,
    });
  }

  return candles;
}

// ─── Symbol watchlist snapshot ───────────────────────────────────────────────
export function generateSymbolInfo(): SymbolInfo[] {
  return SYMBOLS.map((sym) => {
    const state = priceStates.get(sym)!;
    const price = state.price;
    const change = price - state.basePrice;
    const changePct = (change / state.basePrice) * 100;

    return {
      symbol: sym,
      name: SYMBOL_META[sym].name,
      exchange: SYMBOL_META[sym].exchange,
      lastPrice: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePct.toFixed(2)),
      volume: Math.floor(Math.random() * 5_000_000 + 500_000),
    };
  });
}

// ─── Analytics computation ───────────────────────────────────────────────────
export function computeAnalytics(prices: number[]) {
  const n = prices.length;
  if (n < 30) return null;

  // SMA
  const sma = (window: number) => {
    const slice = prices.slice(-window);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };

  // EMA
  const ema = (window: number, alpha?: number) => {
    const k = alpha ?? 2 / (window + 1);
    let e = prices[0];
    for (let i = 1; i < n; i++) e = prices[i] * k + e * (1 - k);
    return e;
  };

  // RSI (Wilder's)
  const period = 14;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[n - period + i - 1] - prices[n - period + i - 2];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsiVal = 100 - 100 / (1 + rs);

  // MACD
  const ema12 = ema(12);
  const ema26 = ema(26);
  const macdLine = ema12 - ema26;
  const signalLine = macdLine * 0.95; // approximation
  const histogram = macdLine - signalLine;

  // Bollinger
  const s20 = sma(20);
  const slice20 = prices.slice(-20);
  const variance = slice20.reduce((a, b) => a + Math.pow(b - s20, 2), 0) / 20;
  const stdDev = Math.sqrt(variance);
  const upper = s20 + 2 * stdDev;
  const lower = s20 - 2 * stdDev;

  // VWAP approximation
  const vwap = sma(20) * (1 + (Math.random() - 0.5) * 0.001);

  // Volatility
  const returns = prices.slice(-20).map((p, i, a) => i === 0 ? 0 : (p - a[i - 1]) / a[i - 1]);
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const vol = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length) * Math.sqrt(252);

  return {
    sma20: parseFloat(s20.toFixed(4)),
    sma50: parseFloat(sma(Math.min(50, n)).toFixed(4)),
    sma200: parseFloat(sma(Math.min(200, n)).toFixed(4)),
    ema20: parseFloat(ema(20).toFixed(4)),
    vwap: parseFloat(vwap.toFixed(4)),
    volatility: parseFloat((vol * 100).toFixed(4)),
    rsi: {
      value: parseFloat(rsiVal.toFixed(2)),
      isOverbought: rsiVal > 70,
      isOversold: rsiVal < 30,
    },
    macd: {
      macdLine: parseFloat(macdLine.toFixed(4)),
      signalLine: parseFloat(signalLine.toFixed(4)),
      histogram: parseFloat(histogram.toFixed(4)),
    },
    bollinger: {
      upper: parseFloat(upper.toFixed(4)),
      middle: parseFloat(s20.toFixed(4)),
      lower: parseFloat(lower.toFixed(4)),
      bandwidth: parseFloat(((upper - lower) / s20).toFixed(4)),
    },
  };
}

// ─── Sparkline history ───────────────────────────────────────────────────────
export function generateSparklineData(baseValue: number, count: number, noise: number): DataPoint[] {
  const points: DataPoint[] = [];
  let v = baseValue;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    v = Math.max(0, v + (Math.random() - 0.5) * noise);
    points.push({ timestamp: now - i * 1000, value: parseFloat(v.toFixed(2)) });
  }
  return points;
}
