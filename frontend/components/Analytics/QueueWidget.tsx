'use client';

import React from 'react';
import { useMetricsStore } from '@/store/metricsStore';

function queueColor(utilization: number): { bar: string; text: string } {
  if (utilization < 0.5) return { bar: '#22c55e', text: 'text-[#22c55e]' };
  if (utilization <= 0.8) return { bar: '#f59e0b', text: 'text-[#f59e0b]' };
  return { bar: '#ef4444', text: 'text-[#ef4444]' };
}

function QueueBar({ utilization }: { utilization: number }) {
  const { bar } = queueColor(utilization);
  const pct = Math.min(1, Math.max(0, utilization)) * 100;
  return (
    <div className="relative w-full h-2 rounded-full bg-[#252930] overflow-hidden">
      {/* Threshold markers */}
      <div
        className="absolute top-0 bottom-0 w-px opacity-40"
        style={{ left: '50%', backgroundColor: '#22c55e' }}
      />
      <div
        className="absolute top-0 bottom-0 w-px opacity-40"
        style={{ left: '80%', backgroundColor: '#f59e0b' }}
      />
      {/* Fill */}
      <div
        className="absolute top-0 left-0 bottom-0 rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: bar }}
      />
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  colorClass?: string;
  unit?: string;
}

function MetricRow({ label, value, colorClass = 'text-[#e2e8f0]', unit }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] tracking-wider uppercase text-[#64748b]">{label}</span>
      <span className={`font-mono text-xs ${colorClass}`}>
        {value}
        {unit && <span className="text-[9px] text-[#64748b] ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

export default function QueueWidget() {
  const metrics = useMetricsStore((s) => s.metrics);

  const utilization = metrics?.queueUtilization ?? 0;
  const threadCount = metrics?.threadCount ?? 0;
  const cpuPercent = metrics?.cpuPercent ?? 0;
  const memMb = metrics?.memMb ?? 0;

  const { text: queueTextColor } = queueColor(utilization);
  const utilizationPct = (utilization * 100).toFixed(1);

  const cpuColor =
    cpuPercent > 80 ? 'text-[#ef4444]' : cpuPercent > 50 ? 'text-[#f59e0b]' : 'text-[#22c55e]';
  const memColor =
    memMb > 1024 ? 'text-[#f59e0b]' : 'text-[#e2e8f0]';

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <span className="text-[10px] tracking-wider uppercase text-[#64748b]">SYSTEM RESOURCES</span>

      {/* Queue utilization */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] tracking-wider uppercase text-[#64748b]">QUEUE UTILIZATION</span>
          <span className={`font-mono text-sm font-semibold ${queueTextColor}`}>
            {utilizationPct}%
          </span>
        </div>
        <QueueBar utilization={utilization} />
        <div className="flex justify-between">
          <span className="text-[8px] font-mono text-[#22c55e]">0%</span>
          <span className="text-[8px] font-mono text-[#f59e0b]">50%</span>
          <span className="text-[8px] font-mono text-[#ef4444]">80%+</span>
        </div>
      </div>

      {/* CPU bar */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] tracking-wider uppercase text-[#64748b]">CPU</span>
          <span className={`font-mono text-xs ${cpuColor}`}>{cpuPercent.toFixed(1)}%</span>
        </div>
        <div className="relative w-full h-1 rounded-full bg-[#252930] overflow-hidden">
          <div
            className="absolute top-0 left-0 bottom-0 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, cpuPercent)}%`,
              backgroundColor: cpuPercent > 80 ? '#ef4444' : cpuPercent > 50 ? '#f59e0b' : '#22c55e',
            }}
          />
        </div>
      </div>

      {/* Other metrics */}
      <div className="flex flex-col gap-0.5 border-t border-[#252930] pt-1">
        <MetricRow
          label="THREADS"
          value={threadCount.toString()}
          colorClass="text-[#3b82f6]"
        />
        <MetricRow
          label="MEMORY"
          value={memMb >= 1024 ? (memMb / 1024).toFixed(2) : memMb.toFixed(0)}
          unit={memMb >= 1024 ? 'GB' : 'MB'}
          colorClass={memColor}
        />
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5 border-t border-[#252930] pt-1">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            utilization < 0.5 ? 'bg-[#22c55e]' : utilization <= 0.8 ? 'bg-[#f59e0b]' : 'bg-[#ef4444] animate-pulse'
          }`}
        />
        <span className="text-[9px] uppercase tracking-wider text-[#64748b]">
          {utilization < 0.5 ? 'HEALTHY' : utilization <= 0.8 ? 'MODERATE LOAD' : 'HIGH LOAD'}
        </span>
      </div>
    </div>
  );
}
