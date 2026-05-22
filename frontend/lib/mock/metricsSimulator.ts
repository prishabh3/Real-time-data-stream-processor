import type { PerformanceMetrics } from "@/lib/types";

// Simulates realistic backend performance metrics
interface MetricsState {
  totalTicks: number;
  baseLatency: number;
  baseThroughput: number;
  queueFill: number;
}

const state: MetricsState = {
  totalTicks: 0,
  baseLatency: 0.42,
  baseThroughput: 10000,
  queueFill: 0.12,
};

export function generateMetrics(): PerformanceMetrics {
  // Simulate realistic fluctuations
  state.totalTicks += Math.floor(Math.random() * 200 + 50);

  const throughput = state.baseThroughput + (Math.random() - 0.5) * 2000;
  const avgLatency = Math.max(0.05, state.baseLatency + (Math.random() - 0.5) * 0.15);
  const peakLatency = avgLatency * (1.5 + Math.random() * 1.5);
  const queueUtil = Math.max(0.02, Math.min(0.95, state.queueFill + (Math.random() - 0.5) * 0.05));
  state.queueFill = queueUtil;

  // Occasional latency spikes
  const spiked = Math.random() < 0.03;
  const cpuBase = 18 + throughput / 1000;

  return {
    totalTicksProcessed: state.totalTicks,
    averageLatencyMs: parseFloat((spiked ? avgLatency * 4 : avgLatency).toFixed(3)),
    peakLatencyMs: parseFloat((spiked ? peakLatency * 6 : peakLatency).toFixed(3)),
    throughputPerSecond: parseFloat(throughput.toFixed(1)),
    startTime: Date.now() - 120_000,
    queueUtilization: parseFloat(queueUtil.toFixed(4)),
    threadCount: 4,
    cpuPercent: parseFloat(Math.min(100, cpuBase + (Math.random() - 0.5) * 8).toFixed(1)),
    memMb: parseFloat((312 + Math.random() * 24).toFixed(1)),
    activeFeeds: 1,
  };
}
