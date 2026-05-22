"use client";

import { useEffect } from "react";
import { useDataStreams } from "@/lib/websocket/useDataStreams";
import StatusBar from "@/components/StatusBar/StatusBar";
import Sidebar from "@/components/Sidebar/Sidebar";
import ChartPanel from "@/components/Chart/ChartPanel";
import OrderBookPanel from "@/components/OrderBook/OrderBookPanel";
import AnalyticsPanel from "@/components/Analytics/AnalyticsPanel";
import { useMarketStore } from "@/store/marketStore";
import { useMetricsStore } from "@/store/metricsStore";

// Keyboard shortcut hook
function useKeyboardShortcuts() {
  const { setActiveSymbol, symbols } = useMarketStore();
  const { setConnectionState } = useMetricsStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      // Symbol selection: 1–8
      const num = parseInt(e.key);
      if (num >= 1 && num <= 8 && symbols[num - 1]) {
        setActiveSymbol(symbols[num - 1].symbol);
        return;
      }

      switch (e.key.toLowerCase()) {
        case "/":
          e.preventDefault();
          document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus();
          break;
        case "escape":
          document.querySelector<HTMLInputElement>("input:focus")?.blur();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [symbols, setActiveSymbol]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function TradingDashboard() {
  // Initialize all data streams
  useDataStreams();
  useKeyboardShortcuts();

  return (
    <div className="flex flex-col h-screen bg-[#0d0f12] overflow-hidden select-none">
      {/* Top status bar */}
      <StatusBar />

      {/* Main workspace — 3-column layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar: watchlist + nav */}
        <Sidebar />

        {/* Center: chart + analytics stacked */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Chart panel — takes most vertical space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChartPanel />
          </div>

          {/* Bottom analytics panel — fixed height */}
          <div className="h-[200px] shrink-0 border-t border-[#252930]">
            <AnalyticsPanel />
          </div>
        </div>

        {/* Right panel: order book + trades */}
        <div className="w-[280px] shrink-0 border-l border-[#252930] flex flex-col min-h-0">
          <OrderBookPanel />
        </div>
      </div>
    </div>
  );
}
