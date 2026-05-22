"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/store/marketStore";
import { useOrderBookStore } from "@/store/orderbookStore";
import { useMetricsStore } from "@/store/metricsStore";
import {
  generateTick,
  aggregateTick,
  generateHistoricalCandles,
  generateSymbolInfo,
  computeAnalytics,
} from "@/lib/mock/marketSimulator";
import { generateOrderBook } from "@/lib/mock/orderbookSimulator";
import { generateMetrics } from "@/lib/mock/metricsSimulator";
import { generateTrade, generateInitialTrades } from "@/lib/mock/tradesSimulator";
import { SYMBOLS } from "@/lib/mock/marketSimulator";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// Rolling price buffer per symbol for analytics computation
const priceBuffers = new Map<string, number[]>();

export function useDataStreams() {
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orderbookIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { setSymbols, setCandles, appendCandle, setLastPrice, setAnalytics,
    appendPricePoint, activeSymbol, timeframe } = useMarketStore();
  const { setSnapshot, appendTrade, setInitialTrades } = useOrderBookStore();
  const { setMetrics, setConnectionState, appendLatency, appendThroughput } = useMetricsStore();

  useEffect(() => {
    if (!USE_MOCK) return;

    // ── Seed initial data ──────────────────────────────────────────────────
    setConnectionState("CONNECTING");
    setSymbols(generateSymbolInfo());

    SYMBOLS.forEach((sym) => {
      // Historical candles for all timeframes
      ["1m", "5m", "15m", "1H", "4H", "1D"].forEach((tf) => {
        setCandles(sym, tf, generateHistoricalCandles(sym, tf, 300));
      });
      // Initial trades
      const meta = { basePrice: 100 };
      setInitialTrades(sym, generateInitialTrades(sym, 100, 30));
    });

    setTimeout(() => setConnectionState("CONNECTED"), 800);

    // ── Tick stream: 10ms interval matching backend config ─────────────────
    tickIntervalRef.current = setInterval(() => {
      SYMBOLS.forEach((sym) => {
        const tick = generateTick(sym);

        // Update last price
        setLastPrice(sym, tick.price);

        // Price history for sparklines
        appendPricePoint(sym, { timestamp: tick.timestamp, value: tick.price });

        // Update watchlist
        const buffer = priceBuffers.get(sym) ?? [];
        buffer.push(tick.price);
        if (buffer.length > 300) buffer.shift();
        priceBuffers.set(sym, buffer);

        // Candle aggregation
        const candle = aggregateTick(tick, timeframe);
        if (candle) appendCandle(sym, timeframe, candle);

        // Occasional analytics update
        if (buffer.length >= 30 && Math.random() < 0.05) {
          const a = computeAnalytics(buffer);
          if (a) {
            setAnalytics(sym, {
              ...a,
              symbol: sym,
              vwap: a.vwap,
              timestamp: Date.now(),
            } as any);
          }
        }

        // Occasional order book + trade
        if (Math.random() < 0.3) {
          setSnapshot(sym, generateOrderBook(sym, tick.price));
        }
        if (Math.random() < 0.15) {
          appendTrade(sym, generateTrade(sym, tick.price));
        }
      });
    }, 100); // 100ms UI refresh (backend runs at 10ms, batching for React)

    // ── Metrics stream: 1s interval ────────────────────────────────────────
    metricsIntervalRef.current = setInterval(() => {
      const m = generateMetrics();
      setMetrics(m);
      appendLatency(m.averageLatencyMs);
      appendThroughput(m.throughputPerSecond);
    }, 1000);

    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
      if (orderbookIntervalRef.current) clearInterval(orderbookIntervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
