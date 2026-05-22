"use client";

import { useState, useEffect } from "react";
import { useMetricsStore } from "@/store/metricsStore";
import { useMarketStore } from "@/store/marketStore";
import { Bell, BellRing, Cpu, MemoryStick, Zap, Radio, Layers } from "lucide-react";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  });
}

function ExchangeClock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const nyTime = time ? new Date(time.toLocaleString("en-US", { timeZone: "America/New_York" })) : null;
  const isMarketHours = nyTime
    ? nyTime.getHours() >= 9 && nyTime.getHours() < 16 && nyTime.getDay() >= 1 && nyTime.getDay() <= 5
    : false;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-wider text-[#64748b]">NYSE</span>
        <span className="font-mono text-[11px] text-[#94a3b8]">{time ? formatTime(time) : "--:--:--"}</span>
      </div>
      <div className={`text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-sm ${
        isMarketHours ? "text-[#22c55e] bg-[#0f2218]" : "text-[#f59e0b] bg-[#1f1a0f]"
      }`}>
        {isMarketHours ? "OPEN" : "CLOSED"}
      </div>
    </div>
  );
}

export default function StatusBar() {
  const { metrics, connectionState, alerts } = useMetricsStore();
  const { activeSymbol } = useMarketStore();
  const [showAlerts, setShowAlerts] = useState(false);

  const hasAlerts = alerts.length > 0;
  const connColor =
    connectionState === "CONNECTED"
      ? "text-[#22c55e]"
      : connectionState === "RECONNECTING"
      ? "text-[#f59e0b]"
      : "text-[#ef4444]";

  const latencyColor =
    !metrics ? "text-[#64748b]" :
    metrics.averageLatencyMs < 1 ? "text-[#22c55e]" :
    metrics.averageLatencyMs < 5 ? "text-[#f59e0b]" :
    "text-[#ef4444]";

  return (
    <div className="flex items-center h-8 px-3 bg-[#0a0c0f] border-b border-[#1a1d23] shrink-0 gap-4 text-[11px]">
      {/* Product name */}
      <div className="flex items-center gap-2 mr-2">
        <div className="flex items-center gap-1">
          <span className="text-[#3b82f6] font-semibold tracking-tight text-xs">STREAM</span>
          <span className="text-[#64748b] font-light text-xs">OMS</span>
        </div>
        <div className="w-px h-3 bg-[#252930]" />
      </div>

      {/* Feed connection */}
      <StatusItem icon={<Radio size={10} />} label="FEED">
        <span className={`font-mono ${connColor}`}>{connectionState}</span>
      </StatusItem>

      <div className="w-px h-3 bg-[#252930]" />

      {/* Processing rate */}
      <StatusItem icon={<Zap size={10} />} label="RATE">
        <span className="font-mono text-[#94a3b8]">
          {metrics ? `${(metrics.throughputPerSecond / 1000).toFixed(1)}K` : "—"}{" "}
          <span className="text-[#64748b]">tck/s</span>
        </span>
      </StatusItem>

      {/* Latency */}
      <StatusItem icon={null} label="AVG LAT">
        <span className={`font-mono ${latencyColor}`}>
          {metrics ? `${metrics.averageLatencyMs.toFixed(3)}ms` : "—"}
        </span>
      </StatusItem>

      {/* Peak latency */}
      <StatusItem icon={null} label="PEAK LAT">
        <span className="font-mono text-[#94a3b8]">
          {metrics ? `${metrics.peakLatencyMs.toFixed(3)}ms` : "—"}
        </span>
      </StatusItem>

      <div className="w-px h-3 bg-[#252930]" />

      {/* Threads */}
      <StatusItem icon={<Layers size={10} />} label="THREADS">
        <span className="font-mono text-[#94a3b8]">{metrics?.threadCount ?? 4}</span>
      </StatusItem>

      {/* Queue util */}
      <StatusItem icon={null} label="QUEUE">
        <QueueBar util={metrics?.queueUtilization ?? 0} />
      </StatusItem>

      {/* Total ticks */}
      <StatusItem icon={null} label="TICKS">
        <span className="font-mono text-[#94a3b8]">
          {metrics ? metrics.totalTicksProcessed.toLocaleString() : "—"}
        </span>
      </StatusItem>

      <div className="w-px h-3 bg-[#252930]" />

      {/* CPU */}
      <StatusItem icon={<Cpu size={10} />} label="CPU">
        <span className={`font-mono ${
          (metrics?.cpuPercent ?? 0) > 80 ? "text-[#ef4444]" :
          (metrics?.cpuPercent ?? 0) > 50 ? "text-[#f59e0b]" :
          "text-[#94a3b8]"
        }`}>
          {metrics ? `${metrics.cpuPercent.toFixed(0)}%` : "—"}
        </span>
      </StatusItem>

      {/* Mem */}
      <StatusItem icon={null} label="MEM">
        <span className="font-mono text-[#94a3b8]">
          {metrics ? `${metrics.memMb.toFixed(0)}MB` : "—"}
        </span>
      </StatusItem>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Exchange clock */}
      <ExchangeClock />

      <div className="w-px h-3 bg-[#252930]" />

      {/* Alert bell */}
      <button
        onClick={() => setShowAlerts(!showAlerts)}
        className={`relative flex items-center gap-1 ${hasAlerts ? "text-[#f59e0b]" : "text-[#64748b] hover:text-[#94a3b8]"}`}
      >
        {hasAlerts ? <BellRing size={12} /> : <Bell size={12} />}
        {hasAlerts && (
          <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
            {alerts.length}
          </span>
        )}
      </button>
    </div>
  );
}

function StatusItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      {icon && <span className="text-[#64748b]">{icon}</span>}
      <span className="text-[9px] uppercase tracking-wider text-[#64748b]">{label}</span>
      <span className="text-[#374151]">·</span>
      {children}
    </div>
  );
}

function QueueBar({ util }: { util: number }) {
  const pct = Math.min(100, util * 100);
  const color =
    pct < 50 ? "#22c55e" : pct < 80 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex items-center gap-1">
      <div className="w-16 h-1.5 bg-[#1a1d23] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="font-mono text-[#94a3b8]">{pct.toFixed(0)}%</span>
    </div>
  );
}
