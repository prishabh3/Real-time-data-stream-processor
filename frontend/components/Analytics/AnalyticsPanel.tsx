'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMarketStore } from '@/store/marketStore';
import { useMetricsStore } from '@/store/metricsStore';
import type { RSIDataPoint, MACDDataPoint } from '@/lib/types';

import RSIChart from './RSIChart';
import MACDChart from './MACDChart';
import BollingerWidget from './BollingerWidget';
import VWAPWidget from './VWAPWidget';
import LatencyWidget from './LatencyWidget';
import ThroughputWidget from './ThroughputWidget';
import QueueWidget from './QueueWidget';

type Tab = 'indicators' | 'metrics';

const MAX_HISTORY = 200;

// ─── Tab Button ────────────────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-[10px] tracking-wider uppercase font-medium transition-colors duration-150 rounded-sm ${
        active
          ? 'bg-[#1a1d23] text-[#3b82f6] border border-[#252930]'
          : 'text-[#64748b] hover:text-[#94a3b8] border border-transparent'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Panel card wrapper ────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#111318] border border-[#252930] rounded-sm ${className}`}>
      {children}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────
export default function AnalyticsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('indicators');

  // Market state
  const activeSymbol = useMarketStore((s) => s.activeSymbol);
  const analytics = useMarketStore((s) => s.analytics[s.activeSymbol] ?? null);
  const lastPrice = useMarketStore((s) => s.lastPrices[s.activeSymbol] ?? 0);
  const connectionState = useMetricsStore((s) => s.connectionState);

  // Rolling history refs — updated from analytics updates
  const rsiHistoryRef = useRef<RSIDataPoint[]>([]);
  const macdHistoryRef = useRef<MACDDataPoint[]>([]);

  // Force re-render counter for history changes (historyVersion read to satisfy lint)
  const [historyVersion, setHistoryVersion] = useState(0);
  void historyVersion;
  const bump = useCallback(() => setHistoryVersion((v) => v + 1), []);

  // Append new analytics to rolling history whenever analytics changes
  useEffect(() => {
    if (!analytics) return;

    const now = analytics.timestamp || Date.now();

    // RSI history
    const rsiVal = analytics.rsi?.value;
    if (typeof rsiVal === 'number') {
      const prev = rsiHistoryRef.current;
      const lastEntry = prev[prev.length - 1];
      if (!lastEntry || lastEntry.time !== now) {
        rsiHistoryRef.current = [...prev, { time: now, value: rsiVal }].slice(-MAX_HISTORY);
        bump();
      }
    }

    // MACD history
    const macd = analytics.macd;
    if (macd) {
      const prev = macdHistoryRef.current;
      const lastEntry = prev[prev.length - 1];
      if (!lastEntry || lastEntry.time !== now) {
        macdHistoryRef.current = [
          ...prev,
          {
            time: now,
            macdLine: macd.macdLine,
            signalLine: macd.signalLine,
            histogram: macd.histogram,
          },
        ].slice(-MAX_HISTORY);
        bump();
      }
    }
  }, [analytics, bump]);

  // Connection state color
  const connColor =
    connectionState === 'CONNECTED'
      ? 'text-[#22c55e]'
      : connectionState === 'RECONNECTING'
      ? 'text-[#f59e0b]'
      : 'text-[#ef4444]';

  const connDot =
    connectionState === 'CONNECTED'
      ? 'bg-[#22c55e]'
      : connectionState === 'RECONNECTING'
      ? 'bg-[#f59e0b] animate-pulse'
      : 'bg-[#ef4444]';

  return (
    <div className="flex flex-col bg-[#0d0f12] border border-[#252930] rounded-sm overflow-hidden h-full">
      {/* ── Panel Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#252930] bg-[#111318] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-widest uppercase text-[#94a3b8] font-medium">
            ANALYTICS ENGINE
          </span>
          <span className="px-1.5 py-0.5 rounded-sm bg-[#1a1d23] border border-[#252930] text-[#3b82f6] font-mono text-[10px] font-semibold">
            {activeSymbol}
          </span>
          {analytics && (
            <span className="text-[9px] text-[#64748b] font-mono">
              {new Date(analytics.timestamp).toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connDot}`} />
            <span className={`text-[9px] tracking-wider uppercase ${connColor}`}>
              {connectionState}
            </span>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-0.5">
            <TabButton active={activeTab === 'indicators'} onClick={() => setActiveTab('indicators')}>
              Indicators
            </TabButton>
            <TabButton active={activeTab === 'metrics'} onClick={() => setActiveTab('metrics')}>
              Metrics
            </TabButton>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'indicators' ? (
          /* ── Indicators tab ────────────────────────────────────────────────── */
          <div className="flex flex-col gap-0">
            {/* RSI + MACD side-by-side */}
            <div className="grid grid-cols-2 gap-px bg-[#252930]">
              <Card className="rounded-none border-0">
                <div className="p-2">
                  <RSIChart
                    data={rsiHistoryRef.current}
                    current={analytics?.rsi?.value ?? 50}
                  />
                </div>
              </Card>
              <Card className="rounded-none border-0">
                <div className="p-2">
                  <MACDChart
                    data={macdHistoryRef.current}
                    current={
                      analytics?.macd ?? {
                        macdLine: 0,
                        signalLine: 0,
                        histogram: 0,
                      }
                    }
                  />
                </div>
              </Card>
            </div>

            {/* Bollinger + VWAP side-by-side */}
            <div className="grid grid-cols-2 gap-px bg-[#252930]">
              <Card className="rounded-none border-0">
                <BollingerWidget
                  bollinger={analytics?.bollinger ?? null}
                  currentPrice={lastPrice}
                />
              </Card>
              <Card className="rounded-none border-0">
                <VWAPWidget
                  vwap={analytics?.vwap ?? 0}
                  currentPrice={lastPrice}
                  sma20={analytics?.sma20 ?? 0}
                  sma50={analytics?.sma50 ?? 0}
                  ema20={analytics?.ema20 ?? 0}
                  volatility={analytics?.volatility ?? 0}
                />
              </Card>
            </div>

            {/* Quick RSI/MACD summary strip */}
            {analytics && (
              <div className="flex items-center gap-4 px-3 py-1.5 border-t border-[#252930] bg-[#111318]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] tracking-wider text-[#64748b] uppercase">RSI</span>
                  <span
                    className={`font-mono text-xs ${
                      analytics.rsi.isOverbought
                        ? 'text-[#ef4444]'
                        : analytics.rsi.isOversold
                        ? 'text-[#22c55e]'
                        : 'text-[#e2e8f0]'
                    }`}
                  >
                    {analytics.rsi.value.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] tracking-wider text-[#64748b] uppercase">MACD</span>
                  <span
                    className={`font-mono text-xs ${
                      analytics.macd.macdLine > analytics.macd.signalLine
                        ? 'text-[#22c55e]'
                        : 'text-[#ef4444]'
                    }`}
                  >
                    {analytics.macd.macdLine >= 0 ? '+' : ''}
                    {analytics.macd.macdLine.toFixed(3)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] tracking-wider text-[#64748b] uppercase">HIST</span>
                  <span
                    className={`font-mono text-xs ${
                      analytics.macd.histogram >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
                    }`}
                  >
                    {analytics.macd.histogram >= 0 ? '+' : ''}
                    {analytics.macd.histogram.toFixed(3)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] tracking-wider text-[#64748b] uppercase">VWAP</span>
                  <span className="font-mono text-xs text-[#e2e8f0]">
                    {analytics.vwap.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] tracking-wider text-[#64748b] uppercase">SMA200</span>
                  <span
                    className={`font-mono text-xs ${
                      lastPrice > analytics.sma200 ? 'text-[#22c55e]' : 'text-[#ef4444]'
                    }`}
                  >
                    {analytics.sma200.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Metrics tab ────────────────────────────────────────────────────── */
          <div className="flex flex-col gap-0">
            {/* Latency + Throughput */}
            <div className="grid grid-cols-2 gap-px bg-[#252930]">
              <Card className="rounded-none border-0">
                <LatencyWidget />
              </Card>
              <Card className="rounded-none border-0">
                <ThroughputWidget />
              </Card>
            </div>

            {/* Queue widget — full width */}
            <div className="bg-[#252930] h-px" />
            <Card className="rounded-none border-0">
              <QueueWidget />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
