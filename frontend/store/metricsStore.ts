import { create } from "zustand";
import type { PerformanceMetrics, ConnectionState, PriceAlert } from "@/lib/types";

interface MetricsState {
  metrics: PerformanceMetrics | null;
  setMetrics: (m: PerformanceMetrics) => void;

  connectionState: ConnectionState;
  setConnectionState: (s: ConnectionState) => void;

  alerts: PriceAlert[];
  addAlert: (a: PriceAlert) => void;
  dismissAlert: (id: string) => void;

  latencyHistory: { timestamp: number; value: number }[];
  throughputHistory: { timestamp: number; value: number }[];
  appendLatency: (v: number) => void;
  appendThroughput: (v: number) => void;
}

export const useMetricsStore = create<MetricsState>((set) => ({
  metrics: null,
  setMetrics: (metrics) => set({ metrics }),

  connectionState: "CONNECTING",
  setConnectionState: (connectionState) => set({ connectionState }),

  alerts: [],
  addAlert: (a) =>
    set((s) => ({ alerts: [a, ...s.alerts].slice(0, 20) })),
  dismissAlert: (id) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

  latencyHistory: [],
  throughputHistory: [],
  appendLatency: (v) =>
    set((s) => ({
      latencyHistory: [
        ...s.latencyHistory,
        { timestamp: Date.now(), value: v },
      ].slice(-120),
    })),
  appendThroughput: (v) =>
    set((s) => ({
      throughputHistory: [
        ...s.throughputHistory,
        { timestamp: Date.now(), value: v },
      ].slice(-120),
    })),
}));
