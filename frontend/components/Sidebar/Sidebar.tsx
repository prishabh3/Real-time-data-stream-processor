"use client";

import { useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { useMetricsStore } from "@/store/metricsStore";
import { SYMBOL_META, SYMBOLS } from "@/lib/mock/marketSimulator";
import {
  LayoutDashboard,
  BarChart2,
  BookOpen,
  Settings,
  Search,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from "lucide-react";

function formatPrice(p: number): string {
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

export default function Sidebar() {
  const { activeSymbol, setActiveSymbol, symbols } = useMarketStore();
  const { connectionState } = useMetricsStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNav, setActiveNav] = useState("chart");

  const now = new Date();
  const isMarketOpen =
    now.getHours() >= 9 &&
    (now.getHours() < 16 || (now.getHours() === 16 && now.getMinutes() === 0)) &&
    now.getDay() >= 1 &&
    now.getDay() <= 5;

  const filteredSymbols = symbols.filter(
    (s) =>
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full bg-[#111318] border-r border-[#252930] w-[220px] shrink-0">
      {/* Icon nav strip */}
      <div className="flex flex-col items-center py-3 gap-1 w-10 border-r border-[#252930] shrink-0">
        <NavIcon
          icon={<LayoutDashboard size={14} />}
          label="Dashboard"
          active={activeNav === "chart"}
          onClick={() => setActiveNav("chart")}
        />
        <NavIcon
          icon={<BarChart2 size={14} />}
          label="Analytics"
          active={activeNav === "analytics"}
          onClick={() => setActiveNav("analytics")}
        />
        <NavIcon
          icon={<BookOpen size={14} />}
          label="Order Book"
          active={activeNav === "orderbook"}
          onClick={() => setActiveNav("orderbook")}
        />
        <div className="mt-auto">
          <NavIcon
            icon={<Settings size={14} />}
            label="Settings"
            active={activeNav === "settings"}
            onClick={() => setActiveNav("settings")}
          />
        </div>
      </div>

      {/* Symbol list panel */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="px-2 py-2 border-b border-[#252930]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] uppercase tracking-wider text-[#64748b] font-semibold">Watchlist</span>
            <MarketStatusBadge isOpen={isMarketOpen} />
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#64748b]" />
            <input
              type="text"
              placeholder="Search symbol…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d0f12] border border-[#252930] rounded-sm pl-5 pr-2 py-1 text-[11px] font-mono text-[#94a3b8] placeholder-[#3d4552] focus:outline-none focus:border-[#374151] focus:text-[#e2e8f0]"
            />
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto] px-2 py-1 border-b border-[#1a1d23]">
          <span className="text-[9px] uppercase tracking-wider text-[#64748b]">Symbol</span>
          <span className="text-[9px] uppercase tracking-wider text-[#64748b]">Chg%</span>
        </div>

        {/* Symbol rows */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {filteredSymbols.map((sym) => (
            <SymbolRow
              key={sym.symbol}
              sym={sym}
              isActive={sym.symbol === activeSymbol}
              onClick={() => setActiveSymbol(sym.symbol)}
            />
          ))}
          {filteredSymbols.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-[#64748b] text-[10px] uppercase tracking-wider">No symbols found</p>
            </div>
          )}
        </div>

        {/* Bottom feed info */}
        <div className="px-2 py-2 border-t border-[#252930]">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-[#64748b] uppercase tracking-wider">Feed</span>
            <span className={`text-[9px] font-mono uppercase ${
              connectionState === "CONNECTED" ? "text-[#22c55e]" : "text-[#f59e0b]"
            }`}>
              {connectionState === "CONNECTED" ? "SIMULATED" : connectionState}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[9px] text-[#64748b] uppercase tracking-wider">Symbols</span>
            <span className="text-[9px] font-mono text-[#94a3b8]">{SYMBOLS.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavIcon({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-8 h-8 flex items-center justify-center rounded-sm transition-colors ${
        active
          ? "bg-[#1d2433] text-[#3b82f6]"
          : "text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1a1d23]"
      }`}
    >
      {icon}
    </button>
  );
}

function MarketStatusBadge({ isOpen }: { isOpen: boolean }) {
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm ${
      isOpen ? "bg-[#0f2218]" : "bg-[#1f1a0f]"
    }`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-[#22c55e]" : "bg-[#f59e0b]"}`}
        style={isOpen ? { boxShadow: "0 0 4px #22c55e80" } : {}}
      />
      <span className={`text-[9px] uppercase tracking-wider font-semibold ${
        isOpen ? "text-[#22c55e]" : "text-[#f59e0b]"
      }`}>
        {isOpen ? "Live" : "Closed"}
      </span>
    </div>
  );
}

function SymbolRow({
  sym,
  isActive,
  onClick,
}: {
  sym: { symbol: string; name: string; lastPrice: number; changePercent: number; volume: number };
  isActive: boolean;
  onClick: () => void;
}) {
  const isUp = sym.changePercent >= 0;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-2 py-1.5 transition-colors text-left border-l-2 ${
        isActive
          ? "bg-[#1a1d23] border-[#3b82f6]"
          : "border-transparent hover:bg-[#161920] hover:border-[#252930]"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span
            className={`text-[11px] font-semibold font-mono ${
              isActive ? "text-[#e2e8f0]" : "text-[#94a3b8]"
            }`}
          >
            {sym.symbol}
          </span>
          <span
            className={`text-[10px] font-mono ${
              isUp ? "text-[#22c55e]" : "text-[#ef4444]"
            }`}
          >
            {isUp ? "+" : ""}{sym.changePercent.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] font-mono text-[#64748b]">{formatPrice(sym.lastPrice)}</span>
          <span className="text-[9px] font-mono text-[#4b5563]">{formatVolume(sym.volume)}</span>
        </div>
      </div>
    </button>
  );
}
