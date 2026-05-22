"use client";

import dynamic from "next/dynamic";
import PriceTicker from "./PriceTicker";
import ChartToolbar from "./ChartToolbar";

const ChartContainer = dynamic(() => import("./ChartContainer"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0d0f12]">
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-[#3b82f6] rounded-sm animate-pulse"
              style={{
                height: `${12 + i * 6}px`,
                animationDelay: `${i * 0.15}s`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
        <span className="text-[#64748b] text-xs font-mono uppercase tracking-wider">Initializing chart engine</span>
      </div>
    </div>
  ),
});

export default function ChartPanel() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f12]">
      <PriceTicker />
      <ChartToolbar />
      <div className="flex-1 min-h-0">
        <ChartContainer />
      </div>
    </div>
  );
}
