"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type SeriesType,
} from "lightweight-charts";
import { useMarketStore } from "@/store/marketStore";

export default function ChartContainer() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);

  const {
    activeSymbol,
    timeframe,
    candles,
    analytics,
    showSMA,
    showVWAP,
    showBollinger,
  } = useMarketStore();

  const candleKey = `${activeSymbol}:${timeframe}`;
  const candleData = candles[candleKey] ?? [];
  const analyticsData = analytics[activeSymbol];

  // Create chart on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0d0f12" },
        textColor: "#64748b",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
      },
      grid: {
        vertLines: { color: "#1a1d23", style: LineStyle.Solid },
        horzLines: { color: "#1a1d23", style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#3b82f6",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1a1d23",
        },
        horzLine: {
          color: "#3b82f6",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1a1d23",
        },
      },
      rightPriceScale: {
        borderColor: "#252930",
        textColor: "#64748b",
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "#252930",
        timeVisible: true,
        secondsVisible: timeframe === "1m" || timeframe === "5m",
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    });

    chartRef.current = chart;

    // ── Candlestick series (v5 API) ──────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = candleSeries;

    // ── Volume histogram ─────────────────────────────────────────────────
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#1e3a2f",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // ── SMA overlay ──────────────────────────────────────────────────────
    const smaSeries = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    smaSeriesRef.current = smaSeries;

    // ── VWAP overlay ─────────────────────────────────────────────────────
    const vwapSeries = chart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: "VWAP",
    });
    vwapSeriesRef.current = vwapSeries;

    // ── Bollinger bands ──────────────────────────────────────────────────
    const bbUpper = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const bbLower = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    bbUpperRef.current = bbUpper;
    bbLowerRef.current = bbLower;

    // ── Resize observer ──────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load full candle history on symbol/timeframe change
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candleData.length === 0) return;

    try {
      const cData = candleData.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const vData = candleData.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? "#1e3a2f" : "#3d1515",
      }));

      candleSeriesRef.current.setData(cData);
      volumeSeriesRef.current.setData(vData);

      chartRef.current?.timeScale().fitContent();
    } catch (_) {}
  }, [candleKey, candleData.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time candle update
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candleData.length === 0) return;

    const last = candleData[candleData.length - 1];
    try {
      candleSeriesRef.current.update({
        time: last.time as Time,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });
      volumeSeriesRef.current.update({
        time: last.time as Time,
        value: last.volume,
        color: last.close >= last.open ? "#1e3a2f" : "#3d1515",
      });
    } catch (_) {}
  }, [candleData]);

  // Overlay indicator updates
  useEffect(() => {
    if (!smaSeriesRef.current || !vwapSeriesRef.current) return;
    if (!analyticsData || candleData.length === 0) return;

    const smaData = candleData.slice(-50).map((c) => ({
      time: c.time as Time,
      value: analyticsData.sma20,
    }));
    const vwapData = candleData.slice(-50).map((c) => ({
      time: c.time as Time,
      value: analyticsData.vwap,
    }));

    try {
      if (showSMA) smaSeriesRef.current.setData(smaData);
      else smaSeriesRef.current.setData([]);

      if (showVWAP) vwapSeriesRef.current.setData(vwapData);
      else vwapSeriesRef.current.setData([]);

      if (showBollinger && analyticsData.bollinger) {
        const bbU = candleData.slice(-50).map((c) => ({
          time: c.time as Time,
          value: analyticsData.bollinger.upper,
        }));
        const bbL = candleData.slice(-50).map((c) => ({
          time: c.time as Time,
          value: analyticsData.bollinger.lower,
        }));
        bbUpperRef.current?.setData(bbU);
        bbLowerRef.current?.setData(bbL);
      } else {
        bbUpperRef.current?.setData([]);
        bbLowerRef.current?.setData([]);
      }
    } catch (_) {}
  }, [analyticsData, showSMA, showVWAP, showBollinger, candleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={chartContainerRef} className="w-full h-full" />;
}
